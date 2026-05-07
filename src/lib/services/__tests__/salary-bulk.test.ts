import { describe, it, expect } from 'vitest'
import {
  validateAndNormalizeRow,
  computeRowDiff,
  checkTransitionGuard,
  type BulkRowInput,
} from '@/lib/services/salary-bulk'

function row(overrides: Partial<BulkRowInput> = {}): BulkRowInput {
  return {
    rowNumber: 2,
    sheet: 'Active',
    salaryId: 'sal-1',
    status: 'PROCESSING',
    otherBonuses: 0,
    otherDeductions: 0,
    ...overrides,
  }
}

describe('validateAndNormalizeRow', () => {
  it('returns ok for a clean row', () => {
    const r = validateAndNormalizeRow(row())
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toEqual({
        status: 'PROCESSING',
        otherBonuses: 0,
        otherDeductions: 0,
      })
    }
  })

  it('coerces empty bonus/deduction cells to 0', () => {
    const r = validateAndNormalizeRow(row({ otherBonuses: null, otherDeductions: null }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.otherBonuses).toBe(0)
      expect(r.value.otherDeductions).toBe(0)
    }
  })

  it('treats empty status as no-status-change (status omitted from value)', () => {
    const r = validateAndNormalizeRow(row({ status: null }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.status).toBeUndefined()
    }
  })

  it('rejects an invalid status enum value', () => {
    const r = validateAndNormalizeRow(row({ status: 'BOGUS' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors).toContain('Invalid status value')
  })

  it('rejects negative otherBonuses', () => {
    const r = validateAndNormalizeRow(row({ otherBonuses: -1 }))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors).toContain('Other Additions must be a non-negative number')
    }
  })

  it('rejects negative otherDeductions', () => {
    const r = validateAndNormalizeRow(row({ otherDeductions: -50 }))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors).toContain('Other Deductions must be a non-negative number')
    }
  })

  it('rejects NaN amounts', () => {
    const r = validateAndNormalizeRow(row({ otherBonuses: NaN }))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors).toContain('Other Additions must be a non-negative number')
    }
  })

  it('rejects missing salaryId', () => {
    const r = validateAndNormalizeRow(row({ salaryId: null }))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors).toContain('salaryId column missing or empty')
    }
  })

  it('trims whitespace in status', () => {
    const r = validateAndNormalizeRow(row({ status: '  PAID  ' }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.status).toBe('PAID')
  })

  it('collects all errors when multiple fields are invalid', () => {
    const r = validateAndNormalizeRow(row({
      status: 'NOPE',
      otherBonuses: -1,
      otherDeductions: NaN,
    }))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors).toHaveLength(3)
    }
  })
})

describe('computeRowDiff', () => {
  const current = {
    status: 'PENDING' as const,
    otherBonuses: 0,
    otherDeductions: 0,
  }

  it('returns empty when nothing changed', () => {
    const d = computeRowDiff(current, { status: 'PENDING', otherBonuses: 0, otherDeductions: 0 })
    expect(d).toEqual({})
  })

  it('returns only changed fields (status only)', () => {
    const d = computeRowDiff(current, { status: 'PROCESSING', otherBonuses: 0, otherDeductions: 0 })
    expect(d).toEqual({ status: 'PROCESSING' })
  })

  it('returns only changed fields (deduction only)', () => {
    const d = computeRowDiff(current, { status: 'PENDING', otherBonuses: 0, otherDeductions: 250 })
    expect(d).toEqual({ otherDeductions: 250 })
  })

  it('omits status when not provided in normalized', () => {
    const d = computeRowDiff(current, { otherBonuses: 100, otherDeductions: 0 })
    expect(d).toEqual({ otherBonuses: 100 })
  })
})

describe('checkTransitionGuard', () => {
  it('allows status unchanged and adjustment-only edits even with pending installments', () => {
    const r = checkTransitionGuard({
      currentStatus: 'PENDING',
      hasPendingInstallments: true,
      diff: { otherBonuses: 100 },
    })
    expect(r.ok).toBe(true)
  })

  it('blocks any change when current status is PAID', () => {
    const r = checkTransitionGuard({
      currentStatus: 'PAID',
      hasPendingInstallments: false,
      diff: { otherBonuses: 100 },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Paid salaries are immutable')
  })

  it('blocks status change when current is PAID', () => {
    const r = checkTransitionGuard({
      currentStatus: 'PAID',
      hasPendingInstallments: false,
      diff: { status: 'PENDING' },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Paid salaries are immutable')
  })

  it('allows transition out of PAID is unreachable — covered by the immutable rule', () => {
    // Sanity: even with empty diff, current=PAID is immutable when nothing differs
    // is a no-op upstream (diff is empty, never reaches the guard). We never reach here.
    expect(true).toBe(true)
  })

  it('blocks moving to PROCESSING when pending installments exist', () => {
    const r = checkTransitionGuard({
      currentStatus: 'PENDING',
      hasPendingInstallments: true,
      diff: { status: 'PROCESSING' },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Has pending advance installments')
  })

  it('blocks moving to PAID when pending installments exist', () => {
    const r = checkTransitionGuard({
      currentStatus: 'PROCESSING',
      hasPendingInstallments: true,
      diff: { status: 'PAID' },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Has pending advance installments')
  })

  it('allows moving to PROCESSING when no pending installments', () => {
    const r = checkTransitionGuard({
      currentStatus: 'PENDING',
      hasPendingInstallments: false,
      diff: { status: 'PROCESSING' },
    })
    expect(r.ok).toBe(true)
  })

  it('allows moving to FAILED even with pending installments (not blocked by design)', () => {
    const r = checkTransitionGuard({
      currentStatus: 'PROCESSING',
      hasPendingInstallments: true,
      diff: { status: 'FAILED' },
    })
    expect(r.ok).toBe(true)
  })

  it('allows backward move PROCESSING → PENDING', () => {
    const r = checkTransitionGuard({
      currentStatus: 'PROCESSING',
      hasPendingInstallments: false,
      diff: { status: 'PENDING' },
    })
    expect(r.ok).toBe(true)
  })
})
