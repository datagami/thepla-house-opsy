import { describe, it, expect } from 'vitest'
import { computeSalaryBreakdown, type SalaryMathInput } from '@/lib/services/salary-math'

function input(overrides: Partial<SalaryMathInput> = {}): SalaryMathInput {
  return {
    baseSalary: 30000,
    daysInMonth: 30,
    presentDays: 30,
    overtimeDays: 0,
    leavesEarned: 0,
    otherBonuses: 0,
    advanceTotal: 0,
    recurringDeductions: [],
    ...overrides,
  }
}

describe('computeSalaryBreakdown — base earnings', () => {
  it('full month, no extras → net == base salary (rounded)', () => {
    const r = computeSalaryBreakdown(input())
    expect(r.perDaySalary).toBe(1000)
    expect(r.presentDaysAmount).toBe(30000)
    expect(r.overtimeAmount).toBe(0)
    expect(r.leaveSalary).toBe(0)
    expect(r.netSalary).toBe(30000)
  })

  it('half-month attendance halves the earned amount', () => {
    const r = computeSalaryBreakdown(input({ presentDays: 15 }))
    expect(r.presentDaysAmount).toBe(15000)
    expect(r.netSalary).toBe(15000)
  })

  it('overtime adds half-day equivalent per overtime day on top of present-day pay', () => {
    const r = computeSalaryBreakdown(input({ presentDays: 25, overtimeDays: 5 }))
    expect(r.presentDaysAmount).toBe(25000)
    expect(r.overtimeAmount).toBe(2500)
    expect(r.netSalary).toBe(27500)
  })

  it('leavesEarned multiplies per-day salary into leaveSalary and adds to net', () => {
    const r = computeSalaryBreakdown(input({ presentDays: 28, leavesEarned: 2 }))
    expect(r.leaveSalary).toBe(2000)
    expect(r.netSalary).toBe(28000 + 2000)
  })
})

describe('computeSalaryBreakdown — deductions', () => {
  it('subtracts advance total', () => {
    const r = computeSalaryBreakdown(input({ advanceTotal: 5000 }))
    expect(r.netSalary).toBe(25000)
  })

  it('subtracts the sum of recurring deductions', () => {
    const r = computeSalaryBreakdown(input({
      recurringDeductions: [
        { code: 'PT', name: 'Professional Tax', amount: 200 },
      ],
    }))
    expect(r.recurringTotal).toBe(200)
    expect(r.netSalary).toBe(29800)
  })

  it('PT is flat — applies in full even when half-month attendance', () => {
    const r = computeSalaryBreakdown(input({
      presentDays: 15,
      recurringDeductions: [
        { code: 'PT', name: 'Professional Tax', amount: 200 },
      ],
    }))
    expect(r.presentDaysAmount).toBe(15000)
    expect(r.recurringTotal).toBe(200)
    expect(r.netSalary).toBe(14800)
  })

  it('stacks advances + recurring + bonuses correctly', () => {
    const r = computeSalaryBreakdown(input({
      presentDays: 30,
      otherBonuses: 1000,
      advanceTotal: 2000,
      recurringDeductions: [
        { code: 'PT', name: 'Professional Tax', amount: 300 },
      ],
    }))
    expect(r.netSalary).toBe(28700)
  })
})

describe('computeSalaryBreakdown — rounding & edge cases', () => {
  it('handles non-integer per-day salary correctly (29-day month, base 30000)', () => {
    const r = computeSalaryBreakdown(input({ daysInMonth: 29, presentDays: 29 }))
    expect(r.netSalary).toBeCloseTo(30000, 0)
  })

  it('returns 0-net when no attendance and no extras', () => {
    const r = computeSalaryBreakdown(input({ presentDays: 0 }))
    expect(r.netSalary).toBe(0)
  })

  it('net floors at the math result; can be negative (caller decides clamp)', () => {
    const r = computeSalaryBreakdown(input({
      presentDays: 0,
      recurringDeductions: [{ code: 'PT', name: 'PT', amount: 200 }],
    }))
    expect(r.netSalary).toBe(-200)
  })
})
