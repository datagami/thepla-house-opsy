import { describe, it, expect } from 'vitest'
import {
  computeRecurringDeductions,
  sumRecurringDeductions,
  type RecurringDeductionUserInput,
} from '@/lib/services/recurring-deductions'

function user(overrides: Partial<RecurringDeductionUserInput> = {}): RecurringDeductionUserInput {
  return { optInPT: false, optInPF: false, optInESI: false, salary: 15000, ...overrides }
}

describe('computeRecurringDeductions — Professional Tax', () => {
  it('applies PT ₹200 when opted in and salary >= 10000 (non-February)', () => {
    expect(computeRecurringDeductions(user({ optInPT: true, salary: 10000 }), 1))
      .toEqual([{ code: 'PT', name: 'Professional Tax', amount: 200 }])
  })

  it('applies PT ₹300 in February', () => {
    expect(computeRecurringDeductions(user({ optInPT: true, salary: 12000 }), 2))
      .toEqual([{ code: 'PT', name: 'Professional Tax', amount: 300 }])
  })

  it('does not apply PT when salary < 10000 even if opted in', () => {
    expect(computeRecurringDeductions(user({ optInPT: true, salary: 9999 }), 1)).toEqual([])
  })

  it('does not apply PT when not opted in regardless of salary', () => {
    expect(computeRecurringDeductions(user({ optInPT: false, salary: 50000 }), 1)).toEqual([])
  })

  it('does not apply PT when salary is null', () => {
    expect(computeRecurringDeductions(user({ optInPT: true, salary: null }), 1)).toEqual([])
  })

  it('treats threshold as inclusive (salary === 10000 → PT applies)', () => {
    const res = computeRecurringDeductions(user({ optInPT: true, salary: 10000 }), 6)
    expect(res).toHaveLength(1)
    expect(res[0].amount).toBe(200)
  })
})

describe('computeRecurringDeductions — PF/ESI dormant', () => {
  it('ignores PF and ESI flags entirely (no logic yet)', () => {
    expect(computeRecurringDeductions(
      user({ optInPF: true, optInESI: true, salary: 50000 }), 1,
    )).toEqual([])
  })
})

describe('sumRecurringDeductions', () => {
  it('returns 0 for null / undefined / empty', () => {
    expect(sumRecurringDeductions(null)).toBe(0)
    expect(sumRecurringDeductions(undefined)).toBe(0)
    expect(sumRecurringDeductions([])).toBe(0)
  })

  it('sums all entries', () => {
    expect(sumRecurringDeductions([
      { code: 'PT', name: 'PT', amount: 200 },
      { code: 'PF', name: 'PF', amount: 1800 },
    ])).toBe(2000)
  })
})
