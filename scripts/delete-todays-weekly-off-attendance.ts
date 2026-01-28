#!/usr/bin/env npx tsx
/**
 * Delete today's weekly off attendance entries.
 * Use when weekly off was accidentally created for today (e.g. wrong cron run or manual mistake).
 *
 * Usage:
 *   npx tsx scripts/delete-todays-weekly-off-attendance.ts           # delete for today
 *   npx tsx scripts/delete-todays-weekly-off-attendance.ts --dry-run # preview only
 *   npx tsx scripts/delete-todays-weekly-off-attendance.ts --date 2025-01-28  # specific date
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs(): { dryRun: boolean; date: Date } {
  const args = process.argv.slice(2);
  let dryRun = false;
  let date = new Date();
  date.setHours(0, 0, 0, 0);

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--date" && args[i + 1]) {
      const parsed = new Date(args[++i]);
      if (isNaN(parsed.getTime())) {
        console.error("Invalid --date. Use YYYY-MM-DD (e.g. 2025-01-28).");
        process.exit(1);
      }
      date = parsed;
      date.setHours(0, 0, 0, 0);
    }
  }

  return { dryRun, date };
}

async function main() {
  const { dryRun, date } = parseArgs();

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const dateStr = date.toISOString().split("T")[0];
  console.log(
    dryRun ? "[DRY RUN] Would delete" : "Deleting",
    "weekly off attendance for:",
    dateStr
  );

  // Find matching records first (for reporting)
  const toDelete = await prisma.attendance.findMany({
    where: {
      isWeeklyOff: true,
      date: { gte: startOfDay, lte: endOfDay },
    },
    select: {
      id: true,
      userId: true,
      date: true,
      user: { select: { name: true, email: true } },
    },
  });

  if (toDelete.length === 0) {
    console.log("No weekly off attendance entries found for", dateStr);
    return;
  }

  console.log(`Found ${toDelete.length} record(s):`);
  for (const r of toDelete) {
    console.log(`  - ${r.user.name || r.user.email || r.userId} (${r.id})`);
  }

  if (dryRun) {
    console.log("\n[DRY RUN] No records deleted. Run without --dry-run to delete.");
    return;
  }

  const result = await prisma.attendance.deleteMany({
    where: {
      isWeeklyOff: true,
      date: { gte: startOfDay, lte: endOfDay },
    },
  });

  console.log(`\nDeleted ${result.count} weekly off attendance record(s) for ${dateStr}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
