/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    weekOffCredit: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import {
  getWeekOffBalance,
  getMonthlyWeekOffSummary,
  createWeekOffCredit,
  checkWeekOffAvailability,
} from '../week-off-balance'

const mockedPrisma = vi.mocked(prisma)

describe('getWeekOffBalance', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns sum of all credits and debits for a user', async () => {
    mockedPrisma.weekOffCredit.aggregate.mockResolvedValue({
      _sum: { amount: 3 },
    } as any)
    const balance = await getWeekOffBalance('user-1')
    expect(balance).toBe(3)
  })

  it('returns 0 when no credits exist', async () => {
    mockedPrisma.weekOffCredit.aggregate.mockResolvedValue({
      _sum: { amount: null },
    } as any)
    const balance = await getWeekOffBalance('user-1')
    expect(balance).toBe(0)
  })
})

describe('getMonthlyWeekOffSummary', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns credits and debits for a given month', async () => {
    mockedPrisma.weekOffCredit.findMany.mockResolvedValue([
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
    ] as any)
    const summary = await getMonthlyWeekOffSummary('user-1', 3, 2026)
    expect(summary.creditsThisMonth).toBe(4)
    expect(summary.debitsThisMonth).toBe(3)
    expect(summary.unusedThisMonth).toBe(1)
  })

  it('handles 5-week month with all credits used', async () => {
    mockedPrisma.weekOffCredit.findMany.mockResolvedValue([
      ...Array(5).fill({ type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 }),
      ...Array(5).fill({ type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 }),
    ] as any)
    const summary = await getMonthlyWeekOffSummary('user-1', 3, 2026)
    expect(summary.creditsThisMonth).toBe(5)
    expect(summary.debitsThisMonth).toBe(5)
    expect(summary.unusedThisMonth).toBe(0)
  })

  it('handles half-day debit', async () => {
    mockedPrisma.weekOffCredit.findMany.mockResolvedValue([
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -0.5 },
    ] as any)
    const summary = await getMonthlyWeekOffSummary('user-1', 3, 2026)
    expect(summary.unusedThisMonth).toBe(0.5)
  })

  it('excludes encashment debits from monthly usage count', async () => {
    mockedPrisma.weekOffCredit.findMany.mockResolvedValue([
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'ENCASHMENT', amount: -1 },
    ] as any)
    const summary = await getMonthlyWeekOffSummary('user-1', 3, 2026)
    expect(summary.debitsThisMonth).toBe(1)
    expect(summary.unusedThisMonth).toBe(1)
  })
})

describe('checkWeekOffAvailability', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns available when balance > 0', async () => {
    mockedPrisma.weekOffCredit.aggregate.mockResolvedValue({ _sum: { amount: 2 } } as any)
    const result = await checkWeekOffAvailability('user-1')
    expect(result.available).toBe(true)
    expect(result.balance).toBe(2)
  })

  it('returns unavailable when balance is 0', async () => {
    mockedPrisma.weekOffCredit.aggregate.mockResolvedValue({ _sum: { amount: 0 } } as any)
    const result = await checkWeekOffAvailability('user-1')
    expect(result.available).toBe(false)
  })

  it('checks half-day availability', async () => {
    mockedPrisma.weekOffCredit.aggregate.mockResolvedValue({ _sum: { amount: 0.5 } } as any)
    const result = await checkWeekOffAvailability('user-1', 0.5)
    expect(result.available).toBe(true)
  })
})

describe('createWeekOffCredit', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a WEEKLY_GRANT credit entry', async () => {
    const date = new Date('2026-03-01')
    mockedPrisma.weekOffCredit.create.mockResolvedValue({
      id: 'credit-1', userId: 'user-1', date, type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1,
    } as any)
    const result = await createWeekOffCredit({
      userId: 'user-1', date, type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1,
    })
    expect(result.type).toBe('CREDIT')
    expect(result.amount).toBe(1)
  })
})
