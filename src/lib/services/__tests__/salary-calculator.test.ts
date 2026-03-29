import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    attendance: { findMany: vi.fn() },
    advancePayment: { findMany: vi.fn() },
    weekOffCredit: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/services/week-off-balance', () => ({
  getMonthlyWeekOffSummary: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getMonthlyWeekOffSummary } from '@/lib/services/week-off-balance'
import { calculateSalary } from '../salary-calculator'

const mockedPrisma = vi.mocked(prisma)
const mockedGetMonthlyWeekOffSummary = vi.mocked(getMonthlyWeekOffSummary)

describe('calculateSalary - week off adjustment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedPrisma.advancePayment.findMany.mockResolvedValue([])
    mockedGetMonthlyWeekOffSummary.mockResolvedValue({
      creditsThisMonth: 0,
      debitsThisMonth: 0,
      unusedThisMonth: 0,
    })
  })

  it('calculates weekOffAdjustment for encash user with unused week-offs', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      salary: 31000, hasWeeklyOff: true, encashWeekOffs: true,
      weeklyOffType: 'FLEXIBLE', weeklyOffDay: null,
    } as any)

    const regularDays = Array.from({ length: 25 }, () => ({
      isPresent: true, isWeeklyOff: false, isHalfDay: false, overtime: false, isWorkFromHome: false, status: 'APPROVED',
    }))
    const weeklyOffs = Array.from({ length: 3 }, () => ({
      isPresent: true, isWeeklyOff: true, isHalfDay: false, overtime: false, isWorkFromHome: false, status: 'APPROVED',
    }))
    mockedPrisma.attendance.findMany.mockResolvedValue([...regularDays, ...weeklyOffs] as any)

    mockedGetMonthlyWeekOffSummary.mockResolvedValue({
      creditsThisMonth: 5,
      debitsThisMonth: 3,
      unusedThisMonth: 2,
    })

    const result = await calculateSalary('user-1', 3, 2026)
    // perDaySalary = 31000 / 31 = 1000, unused = 2, adjustment = 2000
    expect(result.weekOffAdjustment).toBe(2000)
    expect(result.unusedWeekOffs).toBe(2)
  })

  it('returns 0 weekOffAdjustment for non-encash user', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      salary: 31000, hasWeeklyOff: true, encashWeekOffs: false,
      weeklyOffType: 'FLEXIBLE', weeklyOffDay: null,
    } as any)

    mockedPrisma.attendance.findMany.mockResolvedValue([
      { isPresent: true, isWeeklyOff: true, isHalfDay: false, overtime: false, isWorkFromHome: false, status: 'APPROVED' },
    ] as any)

    mockedGetMonthlyWeekOffSummary.mockResolvedValue({
      creditsThisMonth: 2,
      debitsThisMonth: 1,
      unusedThisMonth: 1,
    })

    const result = await calculateSalary('user-1', 3, 2026)
    expect(result.weekOffAdjustment).toBe(0)
    expect(result.unusedWeekOffs).toBe(1)
  })

  it('returns 0 weekOffAdjustment for user without weekly off', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      salary: 31000, hasWeeklyOff: false, encashWeekOffs: true,
    } as any)

    mockedPrisma.attendance.findMany.mockResolvedValue([
      { isPresent: true, isWeeklyOff: false, isHalfDay: false, overtime: false, isWorkFromHome: false, status: 'APPROVED' },
    ] as any)

    const result = await calculateSalary('user-1', 3, 2026)
    expect(result.weekOffAdjustment).toBe(0)
    expect(result.unusedWeekOffs).toBe(0)
  })

  it('handles 4-week month with all week-offs taken', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      salary: 30000, hasWeeklyOff: true, encashWeekOffs: true,
      weeklyOffType: 'FLEXIBLE', weeklyOffDay: null,
    } as any)

    mockedPrisma.attendance.findMany.mockResolvedValue(
      Array.from({ length: 4 }, () => ({
        isPresent: true, isWeeklyOff: true, isHalfDay: false, overtime: false, isWorkFromHome: false, status: 'APPROVED',
      })) as any
    )

    mockedGetMonthlyWeekOffSummary.mockResolvedValue({
      creditsThisMonth: 4,
      debitsThisMonth: 4,
      unusedThisMonth: 0,
    })

    const result = await calculateSalary('user-1', 4, 2026)
    expect(result.weekOffAdjustment).toBe(0)
    expect(result.unusedWeekOffs).toBe(0)
  })

  it('handles half-day debit in ledger', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      salary: 31000, hasWeeklyOff: true, encashWeekOffs: true,
      weeklyOffType: 'FIXED', weeklyOffDay: 2,
    } as any)

    mockedPrisma.attendance.findMany.mockResolvedValue(
      Array.from({ length: 4 }, () => ({
        isPresent: true, isWeeklyOff: true, isHalfDay: false, overtime: false, isWorkFromHome: false, status: 'APPROVED',
      })) as any
    )

    mockedGetMonthlyWeekOffSummary.mockResolvedValue({
      creditsThisMonth: 5,
      debitsThisMonth: 4.5,
      unusedThisMonth: 0.5,
    })

    const result = await calculateSalary('user-1', 3, 2026)
    // 0.5 unused, perDaySalary = 31000/31 = 1000, adjustment = 500
    expect(result.weekOffAdjustment).toBe(500)
    expect(result.unusedWeekOffs).toBe(0.5)
  })
})
