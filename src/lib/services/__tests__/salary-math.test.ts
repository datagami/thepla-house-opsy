import { describe, it, expect } from 'vitest'
import {
  computeSalaryBreakdown,
  computeNetFromStoredSalary,
  daysInMonth,
  type SalaryMathInput,
  type StoredSalaryNetInput,
} from '@/lib/services/salary-math'

function storedInput(overrides: Partial<StoredSalaryNetInput> = {}): StoredSalaryNetInput {
  return {
    baseSalary: 30000,
    daysInMonth: 30,
    presentDays: 30,
    overtimeDays: 0,
    leavesEarned: 0,
    otherBonuses: 0,
    otherDeductions: 0,
    advanceTotal: 0,
    recurringTotal: 0,
    ...overrides,
  }
}

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

describe('computeNetFromStoredSalary — canonical net (must match ENET)', () => {
  it('full month, nothing extra, → baseSalary', () => {
    expect(computeNetFromStoredSalary(storedInput())).toBe(30000)
  })

  it('half month present → half base', () => {
    expect(computeNetFromStoredSalary(storedInput({ presentDays: 15 }))).toBe(15000)
  })

  it('overtime adds 0.5x perDay per overtime day', () => {
    // 30 days + 2 OT × 0.5 × 1000 = 30000 + 1000 = 31000
    expect(computeNetFromStoredSalary(storedInput({ overtimeDays: 2 }))).toBe(31000)
  })

  it('earned leaves add a perDay each', () => {
    // 30 days + 2 leaves × 1000 = 30000 + 2000 = 32000
    expect(computeNetFromStoredSalary(storedInput({ leavesEarned: 2 }))).toBe(32000)
  })

  it('otherBonuses add directly', () => {
    expect(computeNetFromStoredSalary(storedInput({ otherBonuses: 1000 }))).toBe(31000)
  })

  it('otherDeductions subtract directly', () => {
    expect(computeNetFromStoredSalary(storedInput({ otherDeductions: 2500 }))).toBe(27500)
  })

  it('advanceTotal subtracts', () => {
    expect(computeNetFromStoredSalary(storedInput({ advanceTotal: 5000 }))).toBe(25000)
  })

  it('recurringTotal subtracts', () => {
    expect(computeNetFromStoredSalary(storedInput({ recurringTotal: 200 }))).toBe(29800)
  })

  it('combines everything: present 30 + 2 OT + 2 leaves + ₹1000 bonus − ₹500 ded − ₹3000 advance − ₹200 PT', () => {
    // 30000 + 1000 OT + 2000 leaves + 1000 bonus − 500 − 3000 − 200 = 30300
    expect(computeNetFromStoredSalary(storedInput({
      overtimeDays: 2,
      leavesEarned: 2,
      otherBonuses: 1000,
      otherDeductions: 500,
      advanceTotal: 3000,
      recurringTotal: 200,
    }))).toBe(30300)
  })

  it('half-day fractional presentDays handled', () => {
    // base 30000 / 30 = 1000/day, presentDays 29.5 → 29500
    expect(computeNetFromStoredSalary(storedInput({ presentDays: 29.5 }))).toBe(29500)
  })

  it('rounds final result to nearest rupee', () => {
    // base 18000 / 31 → perDay = 580.65 (rounded), 31 × 580.65 = 18000.15 → round 18000
    expect(computeNetFromStoredSalary(storedInput({
      baseSalary: 18000, daysInMonth: 31, presentDays: 31,
    }))).toBe(18000)
  })

  it('regression: row that previously stored net=18000 now matches ENET=11813', () => {
    // The cmhsqa1wa00k4ljmkcmx9g4gw case from prod analysis.
    // base 18000, full month, otherDeductions 6187.45 — old PROCESSING formula stored 18000;
    // ENET (and now this helper) gives 11813.
    expect(computeNetFromStoredSalary(storedInput({
      baseSalary: 18000, daysInMonth: 31, presentDays: 31,
      otherDeductions: 6187.45,
    }))).toBe(11813)
  })
})

/**
 * These scenarios cover the bug fixed in the attendance / user-update
 * recompute paths: when attendance changes (or weekly-off changes), the
 * recompute MUST preserve any HR adjustment already applied to the salary
 * (otherBonuses / otherDeductions). The fix passes the existing salary's
 * adjustment fields into computeNetFromStoredSalary alongside the fresh
 * attendance counts. These tests pin the merged behavior.
 */
describe('attendance / user-update recompute scenarios — merge existing adjustments', () => {
  const baseRow = {
    baseSalary: 30000,
    daysInMonth: 30,
    advanceTotal: 0,
    recurringTotal: 0,
  }

  it('attendance edit: 25 → 28 days present, ₹500 deduction stays subtracted', () => {
    // perDay 1000. Before edit: 25 × 1000 - 500 = 24500. After: 28 × 1000 - 500 = 27500.
    const before = computeNetFromStoredSalary({
      ...baseRow, presentDays: 25, overtimeDays: 0, leavesEarned: 0,
      otherBonuses: 0, otherDeductions: 500,
    })
    const after = computeNetFromStoredSalary({
      ...baseRow, presentDays: 28, overtimeDays: 0, leavesEarned: 0,
      otherBonuses: 0, otherDeductions: 500,
    })
    expect(before).toBe(24500)
    expect(after).toBe(27500)
    expect(after - before).toBe(3000) // exactly 3 days × ₹1000, deduction preserved
  })

  it('attendance edit: ₹1000 bonus stays added when presentDays changes', () => {
    const before = computeNetFromStoredSalary({
      ...baseRow, presentDays: 20, overtimeDays: 0, leavesEarned: 0,
      otherBonuses: 1000, otherDeductions: 0,
    })
    const after = computeNetFromStoredSalary({
      ...baseRow, presentDays: 25, overtimeDays: 0, leavesEarned: 0,
      otherBonuses: 1000, otherDeductions: 0,
    })
    expect(before).toBe(21000) // 20 × 1000 + 1000
    expect(after).toBe(26000)  // 25 × 1000 + 1000
  })

  it('attendance edit: both bonus AND deduction preserved', () => {
    // 28 days × 1000 + 1000 bonus - 500 deduction = 28500
    expect(computeNetFromStoredSalary({
      ...baseRow, presentDays: 28, overtimeDays: 0, leavesEarned: 0,
      otherBonuses: 1000, otherDeductions: 500,
    })).toBe(28500)
  })

  it('attendance delete reduces presentDays but does not undo HR adjustments', () => {
    // Was 30 days × 1000 + 0 - 500 = 29500.
    // After deleting 1 attendance day → 29 × 1000 - 500 = 28500.
    expect(computeNetFromStoredSalary({
      ...baseRow, presentDays: 29, overtimeDays: 0, leavesEarned: 0,
      otherBonuses: 0, otherDeductions: 500,
    })).toBe(28500)
  })

  it('weekly-off change adds earned leaves but keeps existing deduction subtracted', () => {
    // Same presentDays (28), gains 2 earned leaves after weekly-off enabled.
    // 28 × 1000 + 2 × 1000 - 500 = 29500
    expect(computeNetFromStoredSalary({
      ...baseRow, presentDays: 28, overtimeDays: 0, leavesEarned: 2,
      otherBonuses: 0, otherDeductions: 500,
    })).toBe(29500)
  })

  it('full-absence edge case: 0 days present, ₹500 deduction → net is negative', () => {
    // 0 × 1000 - 500 = -500. Caller is responsible for clamping/handling.
    expect(computeNetFromStoredSalary({
      ...baseRow, presentDays: 0, overtimeDays: 0, leavesEarned: 0,
      otherBonuses: 0, otherDeductions: 500,
    })).toBe(-500)
  })

  it('attendance recompute with PT recurring + adjustment: all stack', () => {
    // 28 days × 1000 + 1000 bonus - 200 deduction - 200 PT - 3000 advance = 25600
    expect(computeNetFromStoredSalary({
      ...baseRow, presentDays: 28, overtimeDays: 2, leavesEarned: 1,
      otherBonuses: 1000, otherDeductions: 200,
      advanceTotal: 3000, recurringTotal: 200,
    })).toBe(
      // 28 × 1000 + 2 × 0.5 × 1000 + 1 × 1000 + 1000 - 200 - 3000 - 200
      // = 28000 + 1000 + 1000 + 1000 - 200 - 3000 - 200 = 27600
      27600
    )
  })

  it('user-PATCH weekly-off-changed scenario: adjustment from prior PENDING preserved', () => {
    // Before user toggle: was 25 days, 0 leaves, ₹500 ded → 24500.
    // After toggle (hasWeeklyOff true → leaves now earnable): 25 days, 2 leaves, ₹500 ded.
    // 25 × 1000 + 2 × 1000 - 500 = 26500.
    expect(computeNetFromStoredSalary({
      ...baseRow, presentDays: 25, overtimeDays: 0, leavesEarned: 2,
      otherBonuses: 0, otherDeductions: 500,
    })).toBe(26500)
  })

  it('partial-month employee (20 days) with adjustment matches what ENET pays', () => {
    // base 30000, 30 days month, presentDays 20, otherDeductions 1500.
    // ENET: 20 × 1000 + 0 - 1500 = 18500.
    // Before fix, stored net would have been baseSalary (30000) on PROCESSING — wrong by 11500.
    // After fix, stored = ENET = 18500.
    expect(computeNetFromStoredSalary({
      ...baseRow, presentDays: 20, overtimeDays: 0, leavesEarned: 0,
      otherBonuses: 0, otherDeductions: 1500,
    })).toBe(18500)
  })
})

describe('daysInMonth', () => {
  it('returns days for non-leap February', () => {
    expect(daysInMonth(2025, 2)).toBe(28)
  })
  it('returns 29 for leap February', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
  })
  it('returns 31 for January', () => {
    expect(daysInMonth(2025, 1)).toBe(31)
  })
  it('returns 30 for April', () => {
    expect(daysInMonth(2026, 4)).toBe(30)
  })
})
