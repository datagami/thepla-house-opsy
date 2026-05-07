// Pure service for the salary bulk import/export feature.
// Routes are thin wrappers around the two exported functions:
//   - buildBulkWorkbook(month, year): Promise<Buffer>
//   - applyBulkImport(input): Promise<BulkImportSummary>

import type { PrismaClient, Prisma } from '@prisma/client'
import {
  computeNetFromStoredSalary,
  daysInMonth as daysInMonthFn,
} from '@/lib/services/salary-math'
import { sumRecurringDeductions } from '@/lib/services/recurring-deductions'
import type { RecurringDeductionEntry } from '@/models/models'

export type SalaryStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED'

export const SALARY_STATUSES: readonly SalaryStatus[] = [
  'PENDING',
  'PROCESSING',
  'PAID',
  'FAILED',
] as const

export const SHEET_ACTIVE = 'Active'
export const SHEET_PARTIAL_ACTIVE = 'Partial Active'

export const MAX_ROWS_PER_UPLOAD = 2000

export type BulkSheetName = typeof SHEET_ACTIVE | typeof SHEET_PARTIAL_ACTIVE

export interface BulkRowInput {
  rowNumber: number              // 1-based spreadsheet row index (header is row 1)
  sheet: BulkSheetName
  salaryId: string | null
  status: string | null          // raw cell value (trimmed) or null if empty
  otherBonuses: number | null    // null means cell was empty -> coerce to 0 later
  otherDeductions: number | null
}

export interface BulkRowFailure {
  rowNumber: number
  sheet: BulkSheetName
  salaryId: string | null
  employeeName: string | null
  errors: string[]
}

export interface BulkSheetCounts {
  rows: number
  updated: number
  unchanged: number
  skipped: number
}

export interface BulkImportSummary {
  ok: true
  month: number
  year: number
  perSheet: Record<BulkSheetName, BulkSheetCounts>
  skippedRows: BulkRowFailure[]
}

// Used internally for diff detection (post-validation, post-coercion).
export interface NormalizedRowEdit {
  status?: SalaryStatus
  otherBonuses?: number
  otherDeductions?: number
}

// Tx type — the callback param of prisma.$transaction.
export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

export interface ApplyBulkImportInput {
  month: number
  year: number
  rows: BulkRowInput[]
  prisma: PrismaClient
}

type ValidateResult =
  | { ok: true; value: NormalizedRowEdit }
  | { ok: false; errors: string[] }

export function validateAndNormalizeRow(row: BulkRowInput): ValidateResult {
  const errors: string[] = []

  if (!row.salaryId || !row.salaryId.trim()) {
    errors.push('salaryId column missing or empty')
  }

  let status: SalaryStatus | undefined
  if (row.status !== null && row.status !== undefined) {
    const trimmed = row.status.toString().trim()
    if (trimmed.length > 0) {
      if ((SALARY_STATUSES as readonly string[]).includes(trimmed)) {
        status = trimmed as SalaryStatus
      } else {
        errors.push('Invalid status value')
      }
    }
  }

  const otherBonuses = row.otherBonuses ?? 0
  if (!Number.isFinite(otherBonuses) || otherBonuses < 0) {
    errors.push('Other Additions must be a non-negative number')
  }

  const otherDeductions = row.otherDeductions ?? 0
  if (!Number.isFinite(otherDeductions) || otherDeductions < 0) {
    errors.push('Other Deductions must be a non-negative number')
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const value: NormalizedRowEdit = {
    otherBonuses,
    otherDeductions,
  }
  if (status) value.status = status
  return { ok: true, value }
}

export interface CurrentSalaryFields {
  status: SalaryStatus
  otherBonuses: number
  otherDeductions: number
}

export function computeRowDiff(
  current: CurrentSalaryFields,
  normalized: NormalizedRowEdit
): NormalizedRowEdit {
  const diff: NormalizedRowEdit = {}
  if (normalized.status !== undefined && normalized.status !== current.status) {
    diff.status = normalized.status
  }
  if (
    normalized.otherBonuses !== undefined &&
    normalized.otherBonuses !== current.otherBonuses
  ) {
    diff.otherBonuses = normalized.otherBonuses
  }
  if (
    normalized.otherDeductions !== undefined &&
    normalized.otherDeductions !== current.otherDeductions
  ) {
    diff.otherDeductions = normalized.otherDeductions
  }
  return diff
}

export interface TransitionGuardInput {
  currentStatus: SalaryStatus
  hasPendingInstallments: boolean
  diff: NormalizedRowEdit
}

export type TransitionGuardResult = { ok: true } | { ok: false; error: string }

export function checkTransitionGuard(input: TransitionGuardInput): TransitionGuardResult {
  const hasAnyChange =
    input.diff.status !== undefined ||
    input.diff.otherBonuses !== undefined ||
    input.diff.otherDeductions !== undefined

  if (input.currentStatus === 'PAID' && hasAnyChange) {
    return { ok: false, error: 'Paid salaries are immutable' }
  }

  const target = input.diff.status
  if ((target === 'PROCESSING' || target === 'PAID') && input.hasPendingInstallments) {
    return { ok: false, error: 'Has pending advance installments' }
  }

  return { ok: true }
}

export interface SalaryRowForRecompute {
  baseSalary: number
  month: number
  year: number
  presentDays: number
  overtimeDays: number
  halfDays: number
  leavesEarned: number
  leaveSalary: number
  advanceDeduction: number
  deductions: number
  otherBonuses: number
  otherDeductions: number
  recurringDeductions: unknown
}

export interface RecomputeInput {
  salary: SalaryRowForRecompute
  newStatus: SalaryStatus
  newOtherBonuses: number
  newOtherDeductions: number
  approvedInstallmentsTotal: number
}

export interface RecomputeOutput {
  netSalary: number
  advanceDeduction: number
}

export function recomputeNetForRow(input: RecomputeInput): RecomputeOutput {
  const advanceDeduction =
    input.newStatus === 'PROCESSING'
      ? input.approvedInstallmentsTotal
      : input.salary.advanceDeduction

  const recurringTotal = sumRecurringDeductions(
    input.salary.recurringDeductions as RecurringDeductionEntry[] | null
  )

  const netSalary = computeNetFromStoredSalary({
    baseSalary: input.salary.baseSalary,
    daysInMonth: daysInMonthFn(input.salary.year, input.salary.month),
    presentDays: input.salary.presentDays,
    overtimeDays: input.salary.overtimeDays,
    leavesEarned: input.salary.leavesEarned,
    otherBonuses: input.newOtherBonuses,
    otherDeductions: input.newOtherDeductions,
    advanceTotal: advanceDeduction + input.salary.deductions,
    recurringTotal,
  })

  return { netSalary, advanceDeduction }
}
