// Pure service for the salary bulk import/export feature.
// Routes are thin wrappers around the two exported functions:
//   - buildBulkWorkbook(month, year): Promise<Buffer>
//   - applyBulkImport(input): Promise<BulkImportSummary>

import type { PrismaClient, Prisma } from '@prisma/client'

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
