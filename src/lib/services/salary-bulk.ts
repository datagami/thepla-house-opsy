// Pure service for the salary bulk import/export feature.
// Routes are thin wrappers around the two exported functions:
//   - buildBulkWorkbook(month, year): Promise<Buffer>
//   - applyBulkImport(input): Promise<BulkImportSummary>

import type { PrismaClient, Prisma } from '@prisma/client'
import ExcelJS from 'exceljs'
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

export async function applyBulkImport(
  input: ApplyBulkImportInput
): Promise<BulkImportSummary> {
  const summary: BulkImportSummary = {
    ok: true,
    month: input.month,
    year: input.year,
    perSheet: {
      [SHEET_ACTIVE]: { rows: 0, updated: 0, unchanged: 0, skipped: 0 },
      [SHEET_PARTIAL_ACTIVE]: { rows: 0, updated: 0, unchanged: 0, skipped: 0 },
    },
    skippedRows: [],
  }

  const seenIds = new Set<string>()

  for (const row of input.rows) {
    summary.perSheet[row.sheet].rows += 1

    const fail = (errors: string[], salaryId: string | null, employeeName: string | null) => {
      summary.perSheet[row.sheet].skipped += 1
      summary.skippedRows.push({
        rowNumber: row.rowNumber,
        sheet: row.sheet,
        salaryId,
        employeeName,
        errors,
      })
    }

    // 1. Validate the row's raw values.
    const validation = validateAndNormalizeRow(row)
    if (!validation.ok) {
      fail(validation.errors, row.salaryId, null)
      continue
    }

    // 2. Duplicate detection (post-validation, so we have a salaryId).
    const salaryId = row.salaryId as string
    if (seenIds.has(salaryId)) {
      fail(['Duplicate salaryId in upload'], salaryId, null)
      continue
    }
    seenIds.add(salaryId)

    // 3. Per-row transaction.
    try {
      await input.prisma.$transaction(async (tx) => {
        const salary = await tx.salary.findUnique({
          where: { id: salaryId },
          include: { installments: true, user: { select: { name: true } } },
        })

        if (!salary) {
          fail(['Salary not found'], salaryId, null)
          return
        }

        const employeeName = salary.user?.name ?? null

        if (salary.month !== input.month || salary.year !== input.year) {
          fail(['Salary belongs to a different month'], salaryId, employeeName)
          return
        }

        // 4. Diff against DB.
        const current: CurrentSalaryFields = {
          status: salary.status as SalaryStatus,
          otherBonuses: salary.otherBonuses,
          otherDeductions: salary.otherDeductions,
        }
        const diff = computeRowDiff(current, validation.value)
        if (Object.keys(diff).length === 0) {
          summary.perSheet[row.sheet].unchanged += 1
          return
        }

        // 5. Transition guard.
        const hasPendingInstallments = salary.installments.some(
          (i) => i.status === 'PENDING'
        )
        const guard = checkTransitionGuard({
          currentStatus: current.status,
          hasPendingInstallments,
          diff,
        })
        if (!guard.ok) {
          fail([guard.error], salaryId, employeeName)
          return
        }

        // 6. Recompute net.
        const newStatus = (diff.status ?? current.status) as SalaryStatus
        const newOtherBonuses = diff.otherBonuses ?? current.otherBonuses
        const newOtherDeductions = diff.otherDeductions ?? current.otherDeductions

        const approvedInstallmentsTotal = salary.installments
          .filter((i) => i.status === 'APPROVED')
          .reduce((s, i) => s + i.amountPaid, 0)

        const recomputed = recomputeNetForRow({
          salary: {
            baseSalary: salary.baseSalary,
            month: salary.month,
            year: salary.year,
            presentDays: salary.presentDays,
            overtimeDays: salary.overtimeDays,
            halfDays: salary.halfDays,
            leavesEarned: salary.leavesEarned,
            leaveSalary: salary.leaveSalary,
            advanceDeduction: salary.advanceDeduction,
            deductions: salary.deductions,
            otherBonuses: salary.otherBonuses,
            otherDeductions: salary.otherDeductions,
            recurringDeductions: salary.recurringDeductions,
          },
          newStatus,
          newOtherBonuses,
          newOtherDeductions,
          approvedInstallmentsTotal,
        })

        // 7. Build update payload.
        const data: Prisma.SalaryUpdateInput = {
          netSalary: recomputed.netSalary,
          advanceDeduction: recomputed.advanceDeduction,
        }
        if (diff.status !== undefined) {
          data.status = diff.status
          if (diff.status === 'PAID') {
            data.paidAt = new Date()
          } else if (current.status === 'PAID') {
            // Defensive: unreachable due to immutability rule.
            data.paidAt = null
          } else {
            data.paidAt = null
          }
        }
        if (diff.otherBonuses !== undefined) data.otherBonuses = diff.otherBonuses
        if (diff.otherDeductions !== undefined) data.otherDeductions = diff.otherDeductions

        // 8. Write + cleanup pending installments on PROCESSING transition.
        await tx.salary.update({ where: { id: salaryId }, data })

        if (diff.status === 'PROCESSING') {
          await tx.advancePaymentInstallment.deleteMany({
            where: { salaryId, status: 'PENDING' },
          })
        }

        summary.perSheet[row.sheet].updated += 1
      })
    } catch (err) {
      // Unexpected DB error — record as skipped with a generic message.
      const msg = err instanceof Error ? err.message : 'Unexpected error'
      summary.perSheet[row.sheet].skipped += 1
      summary.skippedRows.push({
        rowNumber: row.rowNumber,
        sheet: row.sheet,
        salaryId,
        employeeName: null,
        errors: [`Database error: ${msg}`],
      })
    }
  }

  return summary
}

interface WorkbookSalary {
  id: string
  status: SalaryStatus
  baseSalary: number
  presentDays: number
  otherBonuses: number
  otherDeductions: number
  netSalary: number
  user: {
    name: string | null
    numId: number
    status: string
    branch: { name: string } | null
  } | null
  installments: { status: string; amountPaid: number }[]
}

const COLUMNS = [
  { header: 'salaryId',                  key: 'salaryId',         width: 30, locked: true },
  { header: 'Employee #',                key: 'employeeNumber',   width: 12, locked: true },
  { header: 'Name',                      key: 'name',             width: 24, locked: true },
  { header: 'Branch',                    key: 'branch',           width: 18, locked: true },
  { header: 'Base Salary',               key: 'baseSalary',       width: 14, locked: true },
  { header: 'Present Days',              key: 'presentDays',      width: 12, locked: true },
  { header: 'Status',                    key: 'status',           width: 14, locked: false },
  { header: 'Other Additions',           key: 'otherBonuses',     width: 16, locked: false },
  { header: 'Other Deductions',          key: 'otherDeductions',  width: 16, locked: false },
  { header: 'Net Salary (current)',      key: 'netSalary',        width: 18, locked: true },
  { header: 'Pending Referrals (Total)', key: 'pendingReferrals', width: 22, locked: true },
  { header: 'Pending Installments (Total)', key: 'pendingInstallments', width: 24, locked: true },
] as const

function configureSheet(sheet: ExcelJS.Worksheet) {
  sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }))
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).eachCell((cell) => {
    cell.protection = { locked: true }
  })
  void sheet.protect('', { selectLockedCells: true, selectUnlockedCells: true })
}

function writeRow(
  sheet: ExcelJS.Worksheet,
  s: WorkbookSalary,
  pendingReferralsTotal: number,
  pendingInstallmentsTotal: number
) {
  const row = sheet.addRow({
    salaryId: s.id,
    employeeNumber: s.user?.numId ?? null,
    name: s.user?.name ?? null,
    branch: s.user?.branch?.name ?? null,
    baseSalary: s.baseSalary,
    presentDays: s.presentDays,
    status: s.status,
    otherBonuses: s.otherBonuses,
    otherDeductions: s.otherDeductions,
    netSalary: s.netSalary,
    pendingReferrals: pendingReferralsTotal,
    pendingInstallments: pendingInstallmentsTotal,
  })
  COLUMNS.forEach((c, idx) => {
    const cell = row.getCell(idx + 1)
    cell.protection = { locked: c.locked }
  })
  row.getCell(7).dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: ['"PENDING,PROCESSING,PAID,FAILED"'],
  }
}

export async function buildBulkWorkbook(
  prisma: PrismaClient,
  month: number,
  year: number
): Promise<Buffer> {
  const salaries = await prisma.salary.findMany({
    where: {
      month,
      year,
      user: { status: { in: ['ACTIVE', 'PARTIAL_INACTIVE'] } },
    },
    include: {
      installments: { select: { status: true, amountPaid: true } },
      user: {
        select: {
          name: true,
          numId: true,
          status: true,
          branch: { select: { name: true } },
        },
      },
    },
    orderBy: [{ user: { numId: 'asc' } }],
  })

  // Pre-aggregate pending referrals per user (one query, group in JS).
  const userIds = salaries.map((s) => s.userId)
  const currentMonthEnd = new Date(year, month, 0)
  const referralAgg = await prisma.referral.groupBy({
    by: ['referrerId'],
    where: {
      referrerId: { in: userIds },
      paidAt: null,
      archivedAt: null,
      eligibleAt: { lte: currentMonthEnd },
    },
    _sum: { bonusAmount: true },
  })
  const referralByUser = new Map(
    referralAgg.map((r) => [r.referrerId, r._sum.bonusAmount ?? 0])
  )

  const wb = new ExcelJS.Workbook()
  const active = wb.addWorksheet(SHEET_ACTIVE)
  const partial = wb.addWorksheet(SHEET_PARTIAL_ACTIVE)
  configureSheet(active)
  configureSheet(partial)

  for (const s of salaries) {
    const sheet = s.user?.status === 'ACTIVE' ? active : partial
    const pendingInstallmentsTotal = s.installments
      .filter((i) => i.status === 'PENDING')
      .reduce((sum, i) => sum + i.amountPaid, 0)
    const pendingReferralsTotal = referralByUser.get(s.userId) ?? 0

    writeRow(sheet, s as WorkbookSalary, pendingReferralsTotal, pendingInstallmentsTotal)
  }

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export interface ParseResult {
  ok: boolean
  fileError?: string
  rows: BulkRowInput[]
}

function readCellString(cell: ExcelJS.Cell | undefined): string | null {
  if (!cell) return null
  const v = cell.value
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v.trim() || null
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object' && 'text' in (v as object)) {
    const text = (v as { text?: string }).text
    return text?.trim() || null
  }
  return String(v).trim() || null
}

function readCellNumber(cell: ExcelJS.Cell | undefined): number | null {
  if (!cell) return null
  const v = cell.value
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v.trim())
    return Number.isFinite(n) ? n : NaN
  }
  if (typeof v === 'object' && 'result' in (v as object)) {
    const r = (v as { result?: unknown }).result
    if (typeof r === 'number') return r
  }
  return NaN
}

export async function parseBulkWorkbook(buffer: Buffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  } catch {
    return { ok: false, fileError: 'Invalid workbook', rows: [] }
  }

  const active = wb.getWorksheet(SHEET_ACTIVE)
  const partial = wb.getWorksheet(SHEET_PARTIAL_ACTIVE)
  if (!active && !partial) {
    return { ok: false, fileError: 'No recognized sheets', rows: [] }
  }

  const rows: BulkRowInput[] = []

  function ingest(sheet: ExcelJS.Worksheet | undefined, sheetName: BulkSheetName) {
    if (!sheet) return
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return // header
      // Column A=salaryId, G=Status (col 7), H=otherBonuses (col 8), I=otherDeductions (col 9)
      const salaryId = readCellString(row.getCell(1))
      const status = readCellString(row.getCell(7))
      const otherBonuses = readCellNumber(row.getCell(8))
      const otherDeductions = readCellNumber(row.getCell(9))

      // Skip fully-blank rows.
      if (!salaryId && !status && otherBonuses === null && otherDeductions === null) {
        return
      }

      rows.push({
        rowNumber,
        sheet: sheetName,
        salaryId,
        status,
        otherBonuses,
        otherDeductions,
      })
    })
  }

  ingest(active, SHEET_ACTIVE)
  ingest(partial, SHEET_PARTIAL_ACTIVE)

  if (rows.length > MAX_ROWS_PER_UPLOAD) {
    return {
      ok: false,
      fileError: `Workbook exceeds ${MAX_ROWS_PER_UPLOAD} rows; split and re-upload`,
      rows: [],
    }
  }

  return { ok: true, rows }
}
