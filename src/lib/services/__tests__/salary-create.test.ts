import { describe, it, expect } from 'vitest'
import { buildSalaryCreateData } from '@/lib/services/salary-create'
import type { calculateSalary } from '@/lib/services/salary-calculator'

type SalaryDetails = Awaited<ReturnType<typeof calculateSalary>>

/**
 * Pin down the exact field set the helper emits. The bulk-generate and
 * per-user generate routes both depend on this shape — adding/removing/
 * renaming any field here is a behavior change and must be intentional.
 */

// Minimal salaryDetails fixture: only the fields the helper consumes.
// `as unknown as SalaryDetails` because calculateSalary returns several
// extra fields (attendance, suggestedAdvanceDeductions, etc.) we don't
// need to populate for this contract test.
function makeSalaryDetails(overrides: Partial<SalaryDetails> = {}): SalaryDetails {
  return {
    baseSalary: 25000,
    overtimeAmount: 1500,
    otherBonuses: 0,
    netSalary: 22300,
    presentDays: 28,
    overtimeDays: 5,
    halfDays: 0,
    leavesEarned: 1,
    leaveSalary: 833.33,
    recurringDeductions: [
      { code: 'PT', name: 'Professional Tax', amount: 200 },
    ],
    ...overrides,
  } as unknown as SalaryDetails
}

describe('buildSalaryCreateData', () => {
  it('emits the exact field set both generate routes expect', () => {
    const data = buildSalaryCreateData({
      userId: 'user-123',
      month: 4,
      year: 2026,
      salaryDetails: makeSalaryDetails(),
    })

    // Snapshot-style assertion on every field. This protects against silent
    // field omission (the bug class that caused the per-user route to skip
    // recurringDeductions).
    expect(data).toEqual({
      userId: 'user-123',
      month: 4,
      year: 2026,
      baseSalary: 25000,
      advanceDeduction: 0,
      overtimeBonus: 1500,
      otherBonuses: 0,
      deductions: 0,
      netSalary: 22300,
      presentDays: 28,
      overtimeDays: 5,
      halfDays: 0,
      leavesEarned: 1,
      leaveSalary: 833.33,
      recurringDeductions: [
        { code: 'PT', name: 'Professional Tax', amount: 200 },
      ],
      status: 'PENDING',
    })
  })

  it('passes through PT-only recurring deductions verbatim', () => {
    const data = buildSalaryCreateData({
      userId: 'u1',
      month: 6,
      year: 2026,
      salaryDetails: makeSalaryDetails({
        recurringDeductions: [{ code: 'PT', name: 'Professional Tax', amount: 175 }],
      }),
    })
    expect(data.recurringDeductions).toEqual([
      { code: 'PT', name: 'Professional Tax', amount: 175 },
    ])
  })

  it('passes through empty recurringDeductions as an empty array (not null)', () => {
    const data = buildSalaryCreateData({
      userId: 'u2',
      month: 4,
      year: 2026,
      salaryDetails: makeSalaryDetails({ recurringDeductions: [] }),
    })
    // Critical: must be [] not undefined / null. NULL was what caused the
    // original bug — sumRecurringDeductions(null) returns 0 and PT silently
    // got dropped at the PROCESSING transition.
    expect(data.recurringDeductions).toEqual([])
    expect(data.recurringDeductions).not.toBeNull()
    expect(data.recurringDeductions).not.toBeUndefined()
  })

  it('always creates with status PENDING', () => {
    const data = buildSalaryCreateData({
      userId: 'u3', month: 4, year: 2026, salaryDetails: makeSalaryDetails(),
    })
    expect(data.status).toBe('PENDING')
  })

  it('forces advanceDeduction and deductions to 0 regardless of salaryDetails', () => {
    // salaryDetails has a `deductions` field (totalAdvanceDeduction) but the
    // create payload intentionally writes 0 — installments are linked
    // separately and advanceDeduction is recomputed at the PROCESSING
    // transition.
    const data = buildSalaryCreateData({
      userId: 'u4', month: 4, year: 2026,
      salaryDetails: makeSalaryDetails({
        // @ts-expect-error — deductions exists on the calculator return
        deductions: 5000,
      }),
    })
    expect(data.advanceDeduction).toBe(0)
    expect(data.deductions).toBe(0)
  })

  it('does not emit unexpected extra fields', () => {
    // If something is added here without intent, this test forces an update
    // and the reviewer has to acknowledge it.
    const data = buildSalaryCreateData({
      userId: 'u5', month: 4, year: 2026, salaryDetails: makeSalaryDetails(),
    })
    expect(Object.keys(data).sort()).toEqual([
      'advanceDeduction',
      'baseSalary',
      'deductions',
      'halfDays',
      'leaveSalary',
      'leavesEarned',
      'month',
      'netSalary',
      'otherBonuses',
      'overtimeBonus',
      'overtimeDays',
      'presentDays',
      'recurringDeductions',
      'status',
      'userId',
      'year',
    ])
  })
})
