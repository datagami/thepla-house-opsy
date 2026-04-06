/**
 * Backfill script: Generate WeekOffCredit ledger entries for March 2026
 *
 * For each active user with hasWeeklyOff = true:
 * 1. Create WEEKLY_GRANT CREDIT entries for each Sunday in March
 *    (only Sundays on or after user's createdAt date)
 * 2. Create WEEK_OFF_TAKEN DEBIT entries for each isWeeklyOff attendance in March
 *
 * Usage: npx tsx scripts/backfill-march-week-off-credits.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const isDryRun = process.argv.includes('--dry-run')

  if (isDryRun) {
    console.log('=== DRY RUN MODE — no data will be written ===\n')
  }

  const year = 2026
  const month = 3 // March
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)

  // Find all Sundays in March 2026
  const sundays: Date[] = []
  const current = new Date(startDate)
  while (current <= endDate) {
    if (current.getDay() === 0) {
      sundays.push(new Date(current))
    }
    current.setDate(current.getDate() + 1)
  }
  console.log(`Sundays in March ${year}: ${sundays.map(d => d.getDate()).join(', ')}`)
  console.log(`Total: ${sundays.length} Sundays\n`)

  // Get all users with weekly off
  const users = await prisma.user.findMany({
    where: {
      hasWeeklyOff: true,
      status: { in: ['ACTIVE', 'PARTIAL_INACTIVE'] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      weeklyOffType: true,
      weeklyOffDay: true,
    },
  })

  console.log(`Found ${users.length} users with weekly off\n`)

  let totalCredits = 0
  let totalDebits = 0

  for (const user of users) {
    console.log(`--- ${user.name || user.email || user.id} (${user.weeklyOffType}) ---`)

    // Check if entries already exist (idempotent)
    const existingCredits = await prisma.weekOffCredit.count({
      where: {
        userId: user.id,
        date: { gte: startDate, lte: endDate },
      },
    })

    if (existingCredits > 0) {
      console.log(`  SKIPPED: Already has ${existingCredits} ledger entries for March`)
      continue
    }

    // 1. Create WEEKLY_GRANT credits for eligible Sundays
    const userCreatedAt = new Date(user.createdAt)
    userCreatedAt.setHours(0, 0, 0, 0)

    const eligibleSundays = sundays.filter(s => s >= userCreatedAt)
    console.log(`  Credits: ${eligibleSundays.length} Sundays (joined ${user.createdAt.toISOString().split('T')[0]})`)

    if (!isDryRun) {
      for (const sunday of eligibleSundays) {
        await prisma.weekOffCredit.create({
          data: {
            userId: user.id,
            date: sunday,
            type: 'CREDIT',
            reason: 'WEEKLY_GRANT',
            amount: 1,
            createdBy: 'system:backfill-march-2026',
          },
        })
      }
    }
    totalCredits += eligibleSundays.length

    // 2. Create WEEK_OFF_TAKEN debits for existing weekly off attendance
    const weeklyOffAttendance = await prisma.attendance.findMany({
      where: {
        userId: user.id,
        date: { gte: startDate, lte: endDate },
        isWeeklyOff: true,
        status: 'APPROVED',
      },
      select: { id: true, date: true, isHalfDay: true },
    })

    console.log(`  Debits: ${weeklyOffAttendance.length} week-off days taken`)

    if (!isDryRun) {
      for (const att of weeklyOffAttendance) {
        const amount = att.isHalfDay ? -0.5 : -1
        await prisma.weekOffCredit.create({
          data: {
            userId: user.id,
            date: att.date,
            type: 'DEBIT',
            reason: 'WEEK_OFF_TAKEN',
            amount,
            attendanceId: att.id,
            createdBy: 'system:backfill-march-2026',
          },
        })
      }
    }
    totalDebits += weeklyOffAttendance.length

    const balance = eligibleSundays.length - weeklyOffAttendance.length
    console.log(`  Balance: ${balance}`)
    console.log('')
  }

  console.log('=== SUMMARY ===')
  console.log(`Total CREDIT entries: ${totalCredits}`)
  console.log(`Total DEBIT entries: ${totalDebits}`)
  console.log(`Net balance across all users: ${totalCredits - totalDebits}`)

  if (isDryRun) {
    console.log('\n=== DRY RUN — no data was written. Remove --dry-run to execute. ===')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
