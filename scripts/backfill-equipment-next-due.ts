/**
 * Backfill: recompute each Equipment's lastServiceDate + nextDueDate from its
 * most recent COMPLETED (DONE) maintenance record.
 *
 * Why: historically the records API set the schedule to whichever record was
 * logged LAST, so logging services out of chronological order could let an
 * older service overwrite a newer next-due date. The records API now recomputes
 * from the latest-serviced DONE record; this script repairs any data already
 * skewed by the old behaviour. Idempotent — safe to re-run.
 *
 *   npx tsx scripts/backfill-equipment-next-due.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.equipment.findMany({
    select: { id: true, name: true, lastServiceDate: true, nextDueDate: true },
  });

  let fixed = 0;
  for (const it of items) {
    const latestDone = await prisma.maintenanceRecord.findFirst({
      where: { equipmentId: it.id, status: "DONE" },
      orderBy: [{ serviceDate: "desc" }, { createdAt: "desc" }],
      select: { serviceDate: true, nextDueDate: true },
    });
    if (!latestDone) continue; // no completed service — leave schedule as-is

    const sameLast =
      it.lastServiceDate?.getTime() === latestDone.serviceDate.getTime();
    const sameNext =
      (it.nextDueDate?.getTime() ?? null) ===
      (latestDone.nextDueDate?.getTime() ?? null);
    if (sameLast && sameNext) continue;

    await prisma.equipment.update({
      where: { id: it.id },
      // Deliberately does NOT touch snoozedUntil — preserve any active snooze.
      data: {
        lastServiceDate: latestDone.serviceDate,
        nextDueDate: latestDone.nextDueDate,
      },
    });
    console.log(
      `fixed "${it.name}": lastServiced ${latestDone.serviceDate
        .toISOString()
        .slice(0, 10)}, nextDue ${
        latestDone.nextDueDate?.toISOString().slice(0, 10) ?? "null"
      }`
    );
    fixed++;
  }
  console.log(`Done. ${fixed} item(s) corrected out of ${items.length}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
