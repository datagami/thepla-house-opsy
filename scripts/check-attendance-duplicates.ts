/**
 * Pre-migration safety check.
 *
 * The kiosk plan adds @@unique([userId, date]) to Attendance so the punch
 * upsert is safe. A legacy seed (scripts/seed-attendance.ts) has been known
 * to produce (userId, date) duplicates. If any exist, the migration will
 * fail. This script reports them so they can be deduped (manually) before
 * `prisma migrate dev` is run.
 *
 * Run: npx tsx scripts/check-attendance-duplicates.ts
 * Exit codes: 0 = clean, 1 = duplicates found (printed), 2 = error
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw<
    Array<{ user_id: string; date: Date; cnt: bigint }>
  >`
    SELECT user_id, date, COUNT(*) AS cnt
    FROM attendance
    GROUP BY user_id, date
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, date DESC
  `;

  if (rows.length === 0) {
    console.log("✅ No (userId, date) duplicates in attendance — safe to migrate.");
    return;
  }

  console.error(`❌ Found ${rows.length} (userId, date) duplicate group(s):`);
  for (const r of rows.slice(0, 50)) {
    console.error(`  userId=${r.user_id}  date=${r.date.toISOString().slice(0, 10)}  count=${r.cnt}`);
  }
  if (rows.length > 50) console.error(`  ... and ${rows.length - 50} more`);
  console.error("\nDedupe these (keep the most-recently-updated row) before running migrations.");
  process.exit(1);
}

main()
  .catch((e) => {
    console.error("Check failed:", e);
    process.exit(2);
  })
  .finally(() => prisma.$disconnect());
