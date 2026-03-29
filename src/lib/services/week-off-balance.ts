import { prisma } from '@/lib/prisma'

export type WeekOffCreditType = 'CREDIT' | 'DEBIT'
export type WeekOffCreditReason =
  | 'WEEKLY_GRANT'
  | 'WEEK_OFF_TAKEN'
  | 'ENCASHMENT'
  | 'MANUAL_ADJUSTMENT'
  | 'DELETION_REVERSAL'

interface CreateWeekOffCreditParams {
  userId: string
  date: Date
  type: WeekOffCreditType
  reason: WeekOffCreditReason
  amount: number
  attendanceId?: string
  salaryId?: string
  createdBy?: string
}

/**
 * Get the current week-off balance for a user.
 * Balance = SUM(amount) of all WeekOffCredit entries.
 */
export async function getWeekOffBalance(userId: string): Promise<number> {
  const result = await prisma.weekOffCredit.aggregate({
    where: { userId },
    _sum: { amount: true },
  })
  return result._sum.amount ?? 0
}

/**
 * Get monthly week-off summary: credits granted, week-offs taken, and unused count.
 * Excludes ENCASHMENT debits from "debits this month" since those aren't usage.
 */
export async function getMonthlyWeekOffSummary(
  userId: string,
  month: number,
  year: number
) {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59, 999)

  const entries = await prisma.weekOffCredit.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
  })

  const creditsThisMonth = entries
    .filter((e) => e.type === 'CREDIT')
    .reduce((sum, e) => sum + e.amount, 0)

  // Only count WEEK_OFF_TAKEN debits as "usage" (not ENCASHMENT)
  const debitsThisMonth = entries
    .filter((e) => e.type === 'DEBIT' && e.reason === 'WEEK_OFF_TAKEN')
    .reduce((sum, e) => sum + Math.abs(e.amount), 0)

  const unusedThisMonth = creditsThisMonth - debitsThisMonth

  return { creditsThisMonth, debitsThisMonth, unusedThisMonth }
}

/**
 * Check if a user has enough week-off balance to take a day off.
 * @param requiredAmount - defaults to 1, use 0.5 for half-day
 */
export async function checkWeekOffAvailability(
  userId: string,
  requiredAmount: number = 1
): Promise<{ available: boolean; balance: number }> {
  const balance = await getWeekOffBalance(userId)
  return {
    available: balance >= requiredAmount,
    balance,
  }
}

/**
 * Create a week-off credit/debit ledger entry.
 */
export async function createWeekOffCredit(params: CreateWeekOffCreditParams) {
  return prisma.weekOffCredit.create({
    data: {
      userId: params.userId,
      date: params.date,
      type: params.type,
      reason: params.reason,
      amount: params.amount,
      attendanceId: params.attendanceId,
      salaryId: params.salaryId,
      createdBy: params.createdBy,
    },
  })
}

/**
 * Check if a WEEKLY_GRANT credit already exists for a user on a given date.
 * Used for idempotent cron execution.
 */
export async function hasWeeklyGrantForDate(
  userId: string,
  date: Date
): Promise<boolean> {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const existing = await prisma.weekOffCredit.findFirst({
    where: {
      userId,
      date: { gte: startOfDay, lte: endOfDay },
      type: 'CREDIT',
      reason: 'WEEKLY_GRANT',
    },
  })

  return !!existing
}
