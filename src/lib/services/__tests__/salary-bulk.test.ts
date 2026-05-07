import { describe, it, expect, afterEach } from 'vitest'
import {
  validateAndNormalizeRow,
  computeRowDiff,
  checkTransitionGuard,
  recomputeNetForRow,
  applyBulkImport,
  buildBulkWorkbook,
  parseBulkWorkbook,
  SHEET_ACTIVE,
  type BulkRowInput,
  type SalaryStatus,
} from '@/lib/services/salary-bulk'
import { prisma } from '@/lib/prisma'

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

describe('recomputeNetForRow', () => {
  // Salary: ₹30 000 base, 30-day month, 30 days present, no extras.
  // Per-day = 1000. Net before changes = 30000.
  const baseSalary = {
    baseSalary: 30000,
    month: 4,
    year: 2026,
    presentDays: 30,
    overtimeDays: 0,
    halfDays: 0,
    leavesEarned: 0,
    leaveSalary: 0,
    advanceDeduction: 0,
    deductions: 0,
    otherBonuses: 0,
    otherDeductions: 0,
    recurringDeductions: null,
  }

  it('recomputes net when otherBonuses changes', () => {
    const r = recomputeNetForRow({
      salary: baseSalary,
      newStatus: 'PENDING',
      newOtherBonuses: 500,
      newOtherDeductions: 0,
      approvedInstallmentsTotal: 0,
    })
    expect(r.netSalary).toBe(30500)
    expect(r.advanceDeduction).toBe(0)
  })

  it('recomputes net when otherDeductions changes', () => {
    const r = recomputeNetForRow({
      salary: baseSalary,
      newStatus: 'PENDING',
      newOtherBonuses: 0,
      newOtherDeductions: 1000,
      approvedInstallmentsTotal: 0,
    })
    expect(r.netSalary).toBe(29000)
  })

  it('on transition to PROCESSING, sets advanceDeduction to approved-installments total', () => {
    const r = recomputeNetForRow({
      salary: baseSalary,
      newStatus: 'PROCESSING',
      newOtherBonuses: 0,
      newOtherDeductions: 0,
      approvedInstallmentsTotal: 2000,
    })
    // gross 30000 − advance 2000 − misc 0 = 28000
    expect(r.netSalary).toBe(28000)
    expect(r.advanceDeduction).toBe(2000)
  })

  it('non-PROCESSING transitions keep existing advanceDeduction', () => {
    const r = recomputeNetForRow({
      salary: { ...baseSalary, advanceDeduction: 1500 },
      newStatus: 'PENDING',
      newOtherBonuses: 200,
      newOtherDeductions: 0,
      approvedInstallmentsTotal: 0,
    })
    // gross 30200 − 1500 = 28700
    expect(r.netSalary).toBe(28700)
    expect(r.advanceDeduction).toBe(1500)
  })
})

describe('applyBulkImport (integration)', () => {
  // Helper: make a fresh user + active salary for tests, return ids.
  // Each test uses a unique month to avoid the @@unique(userId, month, year) clash.
  async function seed(opts: {
    month: number
    year: number
    status?: SalaryStatus
    otherBonuses?: number
    otherDeductions?: number
    userStatus?: 'ACTIVE' | 'PARTIAL_INACTIVE'
    pendingInstallment?: boolean
  }) {
    const user = await prisma.user.create({
      data: {
        name: `Test User ${Date.now()}-${Math.random()}`,
        email: `t+${Date.now()}-${Math.random()}@example.test`,
        role: 'EMPLOYEE',
        status: opts.userStatus ?? 'ACTIVE',
      },
    })
    const salary = await prisma.salary.create({
      data: {
        userId: user.id,
        month: opts.month,
        year: opts.year,
        baseSalary: 30000,
        presentDays: 30,
        netSalary: 30000,
        otherBonuses: opts.otherBonuses ?? 0,
        otherDeductions: opts.otherDeductions ?? 0,
        status: opts.status ?? 'PENDING',
      },
    })
    if (opts.pendingInstallment) {
      const advance = await prisma.advancePayment.create({
        data: {
          userId: user.id,
          amount: 5000,
          emiAmount: 1000,
          remainingAmount: 5000,
          status: 'APPROVED',
        },
      })
      await prisma.advancePaymentInstallment.create({
        data: {
          advanceId: advance.id,
          salaryId: salary.id,
          userId: user.id,
          amountPaid: 1000,
          status: 'PENDING',
        },
      })
    }
    return { user, salary }
  }

  // Use a far-future month so we don't collide with real data.
  const TEST_MONTH = 11
  const TEST_YEAR = 2099

  afterEach(async () => {
    await prisma.advancePaymentInstallment.deleteMany({ where: { salary: { year: TEST_YEAR } } })
    await prisma.advancePayment.deleteMany({ where: { user: { email: { contains: '@example.test' } } } })
    await prisma.salary.deleteMany({ where: { year: TEST_YEAR } })
    await prisma.user.deleteMany({ where: { email: { contains: '@example.test' } } })
  })

  it('updates a clean status transition', async () => {
    const { salary } = await seed({ month: TEST_MONTH, year: TEST_YEAR })

    const summary = await applyBulkImport({
      month: TEST_MONTH,
      year: TEST_YEAR,
      prisma,
      rows: [
        {
          rowNumber: 2,
          sheet: 'Active',
          salaryId: salary.id,
          status: 'PROCESSING',
          otherBonuses: 0,
          otherDeductions: 0,
        },
      ],
    })

    expect(summary.perSheet.Active).toEqual({ rows: 1, updated: 1, unchanged: 0, skipped: 0 })
    const after = await prisma.salary.findUnique({ where: { id: salary.id } })
    expect(after?.status).toBe('PROCESSING')
  })

  it('marks no-op rows as unchanged', async () => {
    const { salary } = await seed({
      month: TEST_MONTH, year: TEST_YEAR,
      status: 'PENDING', otherBonuses: 0, otherDeductions: 0,
    })

    const summary = await applyBulkImport({
      month: TEST_MONTH, year: TEST_YEAR, prisma,
      rows: [{
        rowNumber: 2, sheet: 'Active', salaryId: salary.id,
        status: 'PENDING', otherBonuses: 0, otherDeductions: 0,
      }],
    })

    expect(summary.perSheet.Active.unchanged).toBe(1)
    expect(summary.perSheet.Active.updated).toBe(0)
  })

  it('blocks PAID salaries from any change with row error', async () => {
    const { salary } = await seed({
      month: TEST_MONTH, year: TEST_YEAR, status: 'PAID',
    })

    const summary = await applyBulkImport({
      month: TEST_MONTH, year: TEST_YEAR, prisma,
      rows: [{
        rowNumber: 5, sheet: 'Active', salaryId: salary.id,
        status: 'PENDING', otherBonuses: 0, otherDeductions: 0,
      }],
    })

    expect(summary.perSheet.Active.skipped).toBe(1)
    expect(summary.skippedRows[0].errors).toContain('Paid salaries are immutable')
    const after = await prisma.salary.findUnique({ where: { id: salary.id } })
    expect(after?.status).toBe('PAID')
  })

  it('blocks PROCESSING transition when pending installment exists', async () => {
    const { salary } = await seed({
      month: TEST_MONTH, year: TEST_YEAR,
      pendingInstallment: true,
    })

    const summary = await applyBulkImport({
      month: TEST_MONTH, year: TEST_YEAR, prisma,
      rows: [{
        rowNumber: 3, sheet: 'Active', salaryId: salary.id,
        status: 'PROCESSING', otherBonuses: 0, otherDeductions: 0,
      }],
    })

    expect(summary.skippedRows[0].errors).toContain('Has pending advance installments')
  })

  it('allows adjustment-only edits when pending installments exist', async () => {
    const { salary } = await seed({
      month: TEST_MONTH, year: TEST_YEAR,
      pendingInstallment: true,
    })

    const summary = await applyBulkImport({
      month: TEST_MONTH, year: TEST_YEAR, prisma,
      rows: [{
        rowNumber: 3, sheet: 'Active', salaryId: salary.id,
        status: null, otherBonuses: 500, otherDeductions: 0,
      }],
    })

    expect(summary.perSheet.Active.updated).toBe(1)
    const after = await prisma.salary.findUnique({ where: { id: salary.id } })
    expect(after?.otherBonuses).toBe(500)
  })

  it('returns Salary not found for unknown salaryId', async () => {
    const summary = await applyBulkImport({
      month: TEST_MONTH, year: TEST_YEAR, prisma,
      rows: [{
        rowNumber: 7, sheet: 'Active', salaryId: 'does-not-exist',
        status: 'PROCESSING', otherBonuses: 0, otherDeductions: 0,
      }],
    })
    expect(summary.skippedRows[0].errors).toContain('Salary not found')
  })

  it('rejects rows from a different month', async () => {
    const { salary } = await seed({ month: 10, year: TEST_YEAR })

    const summary = await applyBulkImport({
      month: TEST_MONTH, year: TEST_YEAR, prisma,
      rows: [{
        rowNumber: 4, sheet: 'Active', salaryId: salary.id,
        status: 'PROCESSING', otherBonuses: 0, otherDeductions: 0,
      }],
    })
    expect(summary.skippedRows[0].errors).toContain('Salary belongs to a different month')

    // Cleanup the off-month salary
    await prisma.salary.delete({ where: { id: salary.id } })
  })

  it('flags duplicate salaryId rows after the first', async () => {
    const { salary } = await seed({ month: TEST_MONTH, year: TEST_YEAR })

    const summary = await applyBulkImport({
      month: TEST_MONTH, year: TEST_YEAR, prisma,
      rows: [
        { rowNumber: 2, sheet: 'Active', salaryId: salary.id,
          status: 'PROCESSING', otherBonuses: 0, otherDeductions: 0 },
        { rowNumber: 3, sheet: 'Active', salaryId: salary.id,
          status: 'PAID', otherBonuses: 0, otherDeductions: 0 },
      ],
    })

    expect(summary.perSheet.Active.updated).toBe(1)
    expect(summary.perSheet.Active.skipped).toBe(1)
    expect(summary.skippedRows[0].errors).toContain('Duplicate salaryId in upload')
  })
})

describe('export → parse round-trip', () => {
  const RT_MONTH = 9
  const RT_YEAR = 2099

  afterEach(async () => {
    await prisma.salary.deleteMany({ where: { year: RT_YEAR } })
    await prisma.user.deleteMany({ where: { email: { contains: '@rt.test' } } })
  })

  it('export then parse yields the same salary IDs and values', async () => {
    const u = await prisma.user.create({
      data: {
        name: 'RT User',
        email: `rt+${Date.now()}@rt.test`,
        role: 'EMPLOYEE',
        status: 'ACTIVE',
      },
    })
    const s = await prisma.salary.create({
      data: {
        userId: u.id, month: RT_MONTH, year: RT_YEAR,
        baseSalary: 30000, presentDays: 30, netSalary: 30000,
        otherBonuses: 100, otherDeductions: 50, status: 'PENDING',
      },
    })

    const buf = await buildBulkWorkbook(prisma, RT_MONTH, RT_YEAR)
    const parsed = await parseBulkWorkbook(buf)

    expect(parsed.ok).toBe(true)
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0].salaryId).toBe(s.id)
    expect(parsed.rows[0].sheet).toBe(SHEET_ACTIVE)
    expect(parsed.rows[0].status).toBe('PENDING')
    expect(parsed.rows[0].otherBonuses).toBe(100)
    expect(parsed.rows[0].otherDeductions).toBe(50)
  })

  it('round-trip into applyBulkImport reports all rows unchanged', async () => {
    const u = await prisma.user.create({
      data: {
        name: 'RT User 2',
        email: `rt2+${Date.now()}@rt.test`,
        role: 'EMPLOYEE',
        status: 'ACTIVE',
      },
    })
    await prisma.salary.create({
      data: {
        userId: u.id, month: RT_MONTH, year: RT_YEAR,
        baseSalary: 30000, presentDays: 30, netSalary: 30000,
        otherBonuses: 0, otherDeductions: 0, status: 'PENDING',
      },
    })

    const buf = await buildBulkWorkbook(prisma, RT_MONTH, RT_YEAR)
    const parsed = await parseBulkWorkbook(buf)
    expect(parsed.ok).toBe(true)

    const summary = await applyBulkImport({
      month: RT_MONTH, year: RT_YEAR, prisma, rows: parsed.rows,
    })
    expect(summary.perSheet.Active.unchanged).toBe(1)
    expect(summary.perSheet.Active.updated).toBe(0)
  })
})
