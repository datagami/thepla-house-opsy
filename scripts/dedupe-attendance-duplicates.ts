/**
 * Smart dedupe for (user_id, date) duplicate groups in `attendance`.
 *
 * Strategy per group:
 *   1. Score each row's "data signal":
 *        +10 if checkIn  is non-null
 *        +10 if checkOut is non-null
 *        + 1 each for shift_1 / shift_2 / shift_3 == true
 *        + 1 if isPresent == true
 *        + 1 if isHalfDay == true or overtime == true or isWeeklyOff == true or isWorkFromHome == true
 *      → "winner" = the row with the highest score (so a populated row beats an empty stub).
 *   2. Tie-break by most-recent updatedAt.
 *   3. Keep the winner; delete every other row in the group.
 *
 * This safely handles both classes of duplicates we observed:
 *   - PURE-DUPE groups (all rows equal-empty) — tiebreaker decides; no data lost.
 *   - DATA-LOSS-RISK groups (one populated row + empty stubs) — populated row wins.
 *
 * Dry-run by default. Pass `--apply` to actually delete.
 *
 * Run:
 *   npx tsx scripts/dedupe-attendance-duplicates.ts          # dry-run, prints diff
 *   npx tsx scripts/dedupe-attendance-duplicates.ts --apply  # executes deletes inside one transaction
 */
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

interface AttRow {
  id: string;
  user_id: string;
  date: Date;
  is_present: boolean;
  check_in: string | null;
  check_out: string | null;
  is_half_day: boolean;
  overtime: boolean;
  is_weekly_off: boolean;
  is_work_from_home: boolean;
  shift_1: boolean;
  shift_2: boolean;
  shift_3: boolean;
  updated_at: Date;
}

function dataSignalScore(r: AttRow): number {
  let s = 0;
  if (r.check_in) s += 10;
  if (r.check_out) s += 10;
  if (r.shift_1) s += 1;
  if (r.shift_2) s += 1;
  if (r.shift_3) s += 1;
  if (r.is_present) s += 1;
  if (r.is_half_day) s += 1;
  if (r.overtime) s += 1;
  if (r.is_weekly_off) s += 1;
  if (r.is_work_from_home) s += 1;
  return s;
}

function pickWinner(group: AttRow[]): AttRow {
  return [...group].sort((a, b) => {
    const sa = dataSignalScore(a);
    const sb = dataSignalScore(b);
    if (sa !== sb) return sb - sa; // higher score first
    return b.updated_at.getTime() - a.updated_at.getTime(); // newer first
  })[0];
}

function summarize(r: AttRow): string {
  const flags = [
    r.is_present ? "P" : "-",
    r.shift_1 ? "S1" : "  ",
    r.shift_2 ? "S2" : "  ",
    r.shift_3 ? "S3" : "  ",
  ].join("");
  return `${r.id}  ${flags}  in=${(r.check_in ?? "—").padEnd(5)}  out=${(r.check_out ?? "—").padEnd(5)}  upd=${r.updated_at.toISOString()}  score=${dataSignalScore(r)}`;
}

async function main() {
  console.log(`${APPLY ? "🔥 APPLY MODE" : "🧪 DRY-RUN"}\n`);

  const rows = await prisma.$queryRaw<AttRow[]>`
    WITH dups AS (
      SELECT user_id, date FROM attendance
      GROUP BY user_id, date HAVING COUNT(*) > 1
    )
    SELECT a.id, a.user_id, a.date,
           a.is_present, a.check_in, a.check_out,
           a.is_half_day, a.overtime, a.is_weekly_off, a.is_work_from_home,
           a.shift_1, a.shift_2, a.shift_3, a.updated_at
    FROM attendance a
    JOIN dups d ON a.user_id = d.user_id AND a.date = d.date
    ORDER BY a.user_id, a.date, a.updated_at DESC
  `;

  if (rows.length === 0) {
    console.log("✅ No duplicates to dedupe — nothing to do.");
    return;
  }

  // Group
  const groups: Record<string, AttRow[]> = {};
  for (const r of rows) {
    const k = `${r.user_id}|${r.date.toISOString().slice(0, 10)}`;
    (groups[k] = groups[k] || []).push(r);
  }

  const toDelete: string[] = [];
  let pureDupe = 0,
    dataLossSave = 0;

  for (const [k, g] of Object.entries(groups)) {
    const winner = pickWinner(g);
    const losers = g.filter((r) => r.id !== winner.id);
    const winnerScore = dataSignalScore(winner);
    const maxLoserScore = Math.max(0, ...losers.map(dataSignalScore));
    const isDataLossSave = winnerScore > maxLoserScore;
    if (isDataLossSave) dataLossSave++;
    else pureDupe++;

    console.log(
      `\n[${isDataLossSave ? "DATA-LOSS-SAVE" : "PURE-DUPE     "}] ${k}  (${g.length} rows)`
    );
    for (const r of g) {
      const marker = r.id === winner.id ? "  KEEP →" : "  delete ";
      console.log(`  ${marker} ${summarize(r)}`);
    }
    toDelete.push(...losers.map((r) => r.id));
  }

  console.log(
    `\nSummary: ${Object.keys(groups).length} groups (${pureDupe} pure-dupe, ${dataLossSave} data-loss-save) → ${toDelete.length} row(s) to delete`
  );

  if (!APPLY) {
    console.log("\n🧪 Dry-run only. Re-run with --apply to execute.");
    return;
  }

  // Wrapped in a transaction so an unexpected FK or trigger fails atomically
  console.log(`\n🔥 Deleting ${toDelete.length} row(s) in a single transaction...`);
  const result = await prisma.$transaction(
    toDelete.map((id) => prisma.attendance.delete({ where: { id } }))
  );
  console.log(`✅ Deleted ${result.length} row(s).`);

  // Verify clean
  const stillDup = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*)::int AS cnt FROM (
      SELECT 1 FROM attendance GROUP BY user_id, date HAVING COUNT(*) > 1
    ) x
  `;
  const remaining = Number(stillDup[0]?.cnt ?? 0);
  if (remaining === 0) {
    console.log("✅ Verified: zero (user_id, date) duplicate groups remain.");
  } else {
    console.error(`❌ ${remaining} duplicate group(s) still remain — investigate.`);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("Dedupe failed:", e);
    process.exit(2);
  })
  .finally(() => prisma.$disconnect());
