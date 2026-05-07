# Salary Bulk Import / Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bulk export and bulk import for monthly salary processing. HR exports an `.xlsx` workbook split into Active / Partial Active sheets, edits Status / Other Additions / Other Deductions in bulk, and re-uploads. Server applies per-row partial-success updates with PAID-immutability and pending-installment guards, and returns a per-sheet summary that the page renders as a dismissible card.

**Architecture:** Pure service module (`salary-bulk.ts`) holds the workbook builder and the per-row apply logic; thin route handlers (`bulk-export`, `bulk-import`) call into it. A new component (`bulk-import-export.tsx`) renders Export / Import buttons and the summary card, mounted in the existing `salary-management.tsx`. Net-salary recompute reuses `computeNetFromStoredSalary`. No activity logging (consistent with existing per-card flow).

**Tech Stack:** Next.js 15 App Router, Prisma, ExcelJS, vitest, shadcn UI (Alert, Card, Collapsible, Sheet), sonner toasts.

**Spec:** `docs/superpowers/specs/2026-05-07-salary-bulk-import-export-design.md`
**Branch:** `feature/salary-bulk-import-export` (already created)

---

## File Structure

**Create:**
- `src/lib/services/salary-bulk.ts` — pure service: types, status-transition guard, `buildBulkWorkbook`, `applyBulkImport`.
- `src/lib/services/__tests__/salary-bulk.test.ts` — unit tests for `applyBulkImport`.
- `src/app/api/salary/bulk-export/route.ts` — `GET` handler, returns the xlsx.
- `src/app/api/salary/bulk-import/route.ts` — `POST` handler, parses workbook and calls `applyBulkImport`.
- `src/app/api/salary/bulk-import/__tests__/route.test.ts` — integration test (build workbook → POST → assert summary + DB).
- `src/components/salary/bulk-import-export.tsx` — Export + Import buttons, summary card.

**Modify:**
- `src/components/salary/salary-management.tsx` — mount `<BulkImportExport>` next to existing buttons; render summary card area.

**Reuse (no changes):**
- `src/lib/services/salary-math.ts` — `computeNetFromStoredSalary`, `daysInMonth`.
- `src/lib/services/recurring-deductions.ts` — `sumRecurringDeductions`.
- `prisma/schema.prisma` — no schema changes.

---

## Conventions Used Throughout

- **Status enum:** spec calls it `SalaryStatus`, but the DB column is `String` with values `'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED'`. Use a TS literal-union type.
- **Editable fields:** `status`, `otherBonuses`, `otherDeductions`. Everything else in the sheet is locked / informational.
- **Match key on import:** `salaryId` (Column A).
- **Sheet names:** `'Active'` and `'Partial Active'`.
- **Per-row partial success:** errors collected in a `skippedRows[]` array; valid rows continue.
- **Per-row transaction:** `await prisma.$transaction(async (tx) => { ... })` per row. We do not lock the whole month.
- **No activity logging.** Consistent with `bulk-update-status` and the per-card adjustment route.
- **Auth:** `['HR', 'MANAGEMENT']` only.
- **Route runtime:**
  ```ts
  export const runtime = 'nodejs'
  export const maxDuration = 300
  export const dynamic = 'force-dynamic'
  ```
- **Field-level note:** `User.numId` is the human-readable employee number (the schema does not have an `employeeNumber` column).

---

### Task 1: Bootstrap the service module — types and constants

**Files:**
- Create: `src/lib/services/salary-bulk.ts`

- [ ] **Step 1: Create the service skeleton with shared types**

Create `src/lib/services/salary-bulk.ts`:

```ts
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
  otherBonuses: number | null    // null means cell was empty → coerce to 0 later
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
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: No errors related to `src/lib/services/salary-bulk.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/salary-bulk.ts
git commit -m "feat(salary-bulk): scaffold service with shared types"
```

---

### Task 2: Validation + diff helpers (TDD)

These are pure functions with no Prisma — perfect candidates for TDD. They drive the logic of every row check.

**Files:**
- Modify: `src/lib/services/salary-bulk.ts`
- Create: `src/lib/services/__tests__/salary-bulk.test.ts`

- [ ] **Step 1: Write the failing test for `validateAndNormalizeRow`**

Create `src/lib/services/__tests__/salary-bulk.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  validateAndNormalizeRow,
  computeRowDiff,
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
```

- [ ] **Step 2: Run the tests — they should fail (functions not exported yet)**

Run: `npx vitest run src/lib/services/__tests__/salary-bulk.test.ts`
Expected: FAIL with "validateAndNormalizeRow is not exported" or similar import errors.

- [ ] **Step 3: Implement the helpers in the service**

Append to `src/lib/services/salary-bulk.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests — they should pass**

Run: `npx vitest run src/lib/services/__tests__/salary-bulk.test.ts`
Expected: All tests pass (13 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/salary-bulk.ts src/lib/services/__tests__/salary-bulk.test.ts
git commit -m "feat(salary-bulk): add row validation and diff helpers"
```

---

### Task 3: Status transition guard (TDD)

A pure function that says yes/no/why. The DB call to fetch the salary lives in `applyBulkImport`; this guard takes already-loaded data so it can be unit-tested.

**Files:**
- Modify: `src/lib/services/salary-bulk.ts`
- Modify: `src/lib/services/__tests__/salary-bulk.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/services/__tests__/salary-bulk.test.ts`:

```ts
import { checkTransitionGuard } from '@/lib/services/salary-bulk'

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
```

- [ ] **Step 2: Run — should fail (function not exported)**

Run: `npx vitest run src/lib/services/__tests__/salary-bulk.test.ts -t "checkTransitionGuard"`
Expected: FAIL with import error.

- [ ] **Step 3: Implement the guard**

Append to `src/lib/services/salary-bulk.ts`:

```ts
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
```

- [ ] **Step 4: Run — should pass**

Run: `npx vitest run src/lib/services/__tests__/salary-bulk.test.ts`
Expected: All tests pass (~22 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/salary-bulk.ts src/lib/services/__tests__/salary-bulk.test.ts
git commit -m "feat(salary-bulk): add status transition guard"
```

---

### Task 4: Net-salary recompute helper (TDD)

Wrap `computeNetFromStoredSalary` so the bulk path uses identical inputs to `bulk-update-status`. Centralizes the "advance total" derivation when transitioning to PROCESSING.

**Files:**
- Modify: `src/lib/services/salary-bulk.ts`
- Modify: `src/lib/services/__tests__/salary-bulk.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/lib/services/__tests__/salary-bulk.test.ts`:

```ts
import { recomputeNetForRow } from '@/lib/services/salary-bulk'

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
```

- [ ] **Step 2: Run — should fail**

Run: `npx vitest run src/lib/services/__tests__/salary-bulk.test.ts -t "recomputeNetForRow"`
Expected: FAIL with import error.

- [ ] **Step 3: Implement**

Append to `src/lib/services/salary-bulk.ts`:

```ts
import {
  computeNetFromStoredSalary,
  daysInMonth as daysInMonthFn,
} from '@/lib/services/salary-math'
import { sumRecurringDeductions } from '@/lib/services/recurring-deductions'
import type { RecurringDeductionEntry } from '@/models/models'

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
```

- [ ] **Step 4: Run — should pass**

Run: `npx vitest run src/lib/services/__tests__/salary-bulk.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/salary-bulk.ts src/lib/services/__tests__/salary-bulk.test.ts
git commit -m "feat(salary-bulk): add net-salary recompute helper"
```

---

### Task 5: `applyBulkImport` orchestrator (TDD against a real test database)

This is the per-row orchestration that ties helpers together. We write integration-style tests using the real `prisma` client against the dev database (project convention — see `salary-math.test.ts` style tests are pure, but route-level integration uses `prisma`).

**Files:**
- Modify: `src/lib/services/salary-bulk.ts`
- Modify: `src/lib/services/__tests__/salary-bulk.test.ts`

- [ ] **Step 1: Write failing test for `applyBulkImport` (mixed batch)**

Append to `src/lib/services/__tests__/salary-bulk.test.ts`:

```ts
import { applyBulkImport } from '@/lib/services/salary-bulk'
import { prisma } from '@/lib/prisma'

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
```

Add the import for `afterEach`:
```ts
import { afterEach } from 'vitest'
```

- [ ] **Step 2: Run — should fail**

Run: `npx vitest run src/lib/services/__tests__/salary-bulk.test.ts`
Expected: FAIL — `applyBulkImport` not exported.

- [ ] **Step 3: Implement `applyBulkImport`**

Append to `src/lib/services/salary-bulk.ts`:

```ts
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
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run src/lib/services/__tests__/salary-bulk.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/salary-bulk.ts src/lib/services/__tests__/salary-bulk.test.ts
git commit -m "feat(salary-bulk): implement applyBulkImport orchestrator"
```

---

### Task 6: `buildBulkWorkbook` — export builder

Pure function that loads salaries for `(month, year)`, splits by `User.status`, and returns a Buffer.

**Files:**
- Modify: `src/lib/services/salary-bulk.ts`

- [ ] **Step 1: Add the workbook builder**

Append to `src/lib/services/salary-bulk.ts`:

```ts
import ExcelJS from 'exceljs'

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
  // Status dropdown on Column G (rows 2..1000)
  sheet.dataValidations.add('G2:G10000', {
    type: 'list',
    allowBlank: true,
    formulae: ['"PENDING,PROCESSING,PAID,FAILED"'],
  })
  sheet.protect('', { selectLockedCells: true, selectUnlockedCells: true })
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
  const previousMonthEnd = new Date(year, month - 1, 0)
  const referralAgg = await prisma.referral.groupBy({
    by: ['referrerId'],
    where: {
      referrerId: { in: userIds },
      paidAt: null,
      archivedAt: null,
      eligibleAt: { lte: previousMonthEnd },
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: No errors in `salary-bulk.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/salary-bulk.ts
git commit -m "feat(salary-bulk): add buildBulkWorkbook export builder"
```

---

### Task 7: `parseBulkWorkbook` — import parser

Take a Buffer, return `BulkRowInput[]` plus any file-level error.

**Files:**
- Modify: `src/lib/services/salary-bulk.ts`

- [ ] **Step 1: Add the parser**

Append to `src/lib/services/salary-bulk.ts`:

```ts
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
```

- [ ] **Step 2: Add a round-trip test**

Append to `src/lib/services/__tests__/salary-bulk.test.ts`:

```ts
import {
  buildBulkWorkbook,
  parseBulkWorkbook,
  SHEET_ACTIVE,
} from '@/lib/services/salary-bulk'

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
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/lib/services/__tests__/salary-bulk.test.ts`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/salary-bulk.ts src/lib/services/__tests__/salary-bulk.test.ts
git commit -m "feat(salary-bulk): add workbook parser + round-trip test"
```

---

### Task 8: `GET /api/salary/bulk-export` route

Thin wrapper around `buildBulkWorkbook`.

**Files:**
- Create: `src/app/api/salary/bulk-export/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/salary/bulk-export/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { buildBulkWorkbook } from '@/lib/services/salary-bulk'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await auth()
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') ?? '', 10)
  const year = parseInt(searchParams.get('year') ?? '', 10)

  if (!Number.isFinite(month) || month < 1 || month > 12 ||
      !Number.isFinite(year)  || year  < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 })
  }

  const count = await prisma.salary.count({ where: { month, year } })
  if (count === 0) {
    return NextResponse.json({ error: 'No salaries exist for this month' }, { status: 400 })
  }

  const buffer = await buildBulkWorkbook(prisma, month, year)
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="salaries-${year}-${String(month).padStart(2, '0')}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
```

- [ ] **Step 2: Smoke-test in dev**

Run: `npm run dev` (in another terminal if needed)
Sign in as HR, hit `http://localhost:3000/api/salary/bulk-export?month=4&year=2026` (or any month with generated salaries).
Expected: A `.xlsx` file downloads. Open it; verify two sheets `Active` and `Partial Active`, headers correct, rows present.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/salary/bulk-export/route.ts
git commit -m "feat(salary): add bulk-export route"
```

---

### Task 9: `POST /api/salary/bulk-import` route

Thin wrapper around `parseBulkWorkbook` + `applyBulkImport`.

**Files:**
- Create: `src/app/api/salary/bulk-import/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/salary/bulk-import/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { applyBulkImport, parseBulkWorkbook } from '@/lib/services/salary-bulk'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await auth()
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') ?? '', 10)
  const year = parseInt(searchParams.get('year') ?? '', 10)
  if (!Number.isFinite(month) || month < 1 || month > 12 ||
      !Number.isFinite(year)  || year  < 2000 || year > 2100) {
    return NextResponse.json({ ok: false, error: 'Invalid month or year' }, { status: 400 })
  }

  const count = await prisma.salary.count({ where: { month, year } })
  if (count === 0) {
    return NextResponse.json(
      { ok: false, error: 'No salaries exist for this month' },
      { status: 400 }
    )
  }

  let buffer: Buffer
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Missing file field' }, { status: 400 })
    }
    const arr = await file.arrayBuffer()
    buffer = Buffer.from(arr)
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = await parseBulkWorkbook(buffer)
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.fileError }, { status: 400 })
  }

  const summary = await applyBulkImport({ month, year, prisma, rows: parsed.rows })
  return NextResponse.json(summary)
}
```

- [ ] **Step 2: Write integration test**

Create `src/app/api/salary/bulk-import/__tests__/route.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { POST } from '@/app/api/salary/bulk-import/route'
import { buildBulkWorkbook } from '@/lib/services/salary-bulk'
import { prisma } from '@/lib/prisma'

// Mock auth as HR for these tests.
import { auth } from '@/auth'
import { vi } from 'vitest'
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

const TEST_MONTH = 8
const TEST_YEAR = 2099

afterEach(async () => {
  await prisma.salary.deleteMany({ where: { year: TEST_YEAR } })
  await prisma.user.deleteMany({ where: { email: { contains: '@rt.bulk-import.test' } } })
  vi.resetAllMocks()
})

function asHR() {
  ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'hr-1', role: 'HR' },
  })
}

async function seedActiveSalary() {
  const u = await prisma.user.create({
    data: {
      name: 'RT', email: `rt+${Date.now()}@rt.bulk-import.test`,
      role: 'EMPLOYEE', status: 'ACTIVE',
    },
  })
  return prisma.salary.create({
    data: {
      userId: u.id, month: TEST_MONTH, year: TEST_YEAR,
      baseSalary: 30000, presentDays: 30, netSalary: 30000,
      otherBonuses: 0, otherDeductions: 0, status: 'PENDING',
    },
  })
}

function makeRequest(buffer: Buffer, qs: string) {
  const fd = new FormData()
  fd.set('file', new File([buffer], 'upload.xlsx'))
  return new Request(`http://localhost/api/salary/bulk-import?${qs}`, {
    method: 'POST',
    body: fd,
  })
}

describe('POST /api/salary/bulk-import', () => {
  it('returns 401 for non-HR sessions', async () => {
    ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'x', role: 'EMPLOYEE' },
    })
    const res = await POST(makeRequest(Buffer.from(''), 'month=4&year=2026'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when no salaries exist for the month', async () => {
    asHR()
    const res = await POST(makeRequest(Buffer.from(''), `month=1&year=${TEST_YEAR}`))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('No salaries exist for this month')
  })

  it('round-trips a generated workbook', async () => {
    asHR()
    await seedActiveSalary()
    const buf = await buildBulkWorkbook(prisma, TEST_MONTH, TEST_YEAR)
    const res = await POST(makeRequest(buf, `month=${TEST_MONTH}&year=${TEST_YEAR}`))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.perSheet.Active.unchanged).toBe(1)
  })

  it('returns Invalid workbook for garbage data', async () => {
    asHR()
    await seedActiveSalary()
    const res = await POST(
      makeRequest(Buffer.from('not an xlsx'), `month=${TEST_MONTH}&year=${TEST_YEAR}`)
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid workbook')
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/app/api/salary/bulk-import/__tests__/route.test.ts`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/salary/bulk-import/route.ts src/app/api/salary/bulk-import/__tests__/route.test.ts
git commit -m "feat(salary): add bulk-import route + integration tests"
```

---

### Task 10: `BulkImportExport` component — Export button

Start with the simpler half: a button that downloads the file.

**Files:**
- Create: `src/components/salary/bulk-import-export.tsx`

- [ ] **Step 1: Create the component skeleton with Export button**

Create `src/components/salary/bulk-import-export.tsx`:

```tsx
'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface BulkImportExportProps {
  year: number
  month: number
  onImported: () => void
}

interface BulkSheetCounts {
  rows: number
  updated: number
  unchanged: number
  skipped: number
}

interface BulkRowFailure {
  rowNumber: number
  sheet: 'Active' | 'Partial Active'
  salaryId: string | null
  employeeName: string | null
  errors: string[]
}

interface BulkImportSummary {
  ok: true
  month: number
  year: number
  perSheet: {
    Active: BulkSheetCounts
    'Partial Active': BulkSheetCounts
  }
  skippedRows: BulkRowFailure[]
}

export function BulkImportExport({ year, month, onImported }: BulkImportExportProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [summary, setSummary] = useState<BulkImportSummary | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    try {
      setIsExporting(true)
      const res = await fetch(`/api/salary/bulk-export?month=${month}&year=${year}`)
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? 'Export failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `salaries-${year}-${String(month).padStart(2, '0')}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex gap-2 items-center">
      <Button onClick={handleExport} disabled={isExporting} variant="outline">
        {isExporting ? 'Exporting...' : 'Export Salaries'}
      </Button>
      {/* Import button + summary card added in next tasks */}
    </div>
  )
}
```

- [ ] **Step 2: Mount in salary-management.tsx**

In `src/components/salary/salary-management.tsx`:

Add the import near the other component imports:
```ts
import { BulkImportExport } from './bulk-import-export'
```

Inside the JSX, after `<DownloadReportButton .../>` (around line 252), add:
```tsx
<BulkImportExport
  year={selectedYear}
  month={selectedMonth}
  onImported={() => setRefreshKey((p) => p + 1)}
/>
```

- [ ] **Step 3: Smoke test**

Run: `npm run dev`
Visit `/salary`, pick a month with salaries, click Export Salaries. Expected: file downloads.

- [ ] **Step 4: Commit**

```bash
git add src/components/salary/bulk-import-export.tsx src/components/salary/salary-management.tsx
git commit -m "feat(salary): add BulkImportExport component with Export button"
```

---

### Task 11: Import button + confirm + upload

Add the second button. File picker → confirm dialog → POST.

**Files:**
- Modify: `src/components/salary/bulk-import-export.tsx`

- [ ] **Step 1: Add file picker + confirm dialog + upload handler**

In `src/components/salary/bulk-import-export.tsx`, add imports at the top:

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
```

(Confirm `alert-dialog.tsx` exists in `src/components/ui/`. If not, swap to a simple `window.confirm` and skip this import.)

Add state and handler inside the component (just before `return`):

```tsx
const [pendingFile, setPendingFile] = useState<File | null>(null)
const [showConfirm, setShowConfirm] = useState(false)

const monthLabels = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
  const f = e.target.files?.[0]
  if (!f) return
  setPendingFile(f)
  setShowConfirm(true)
  // reset input so the same file can be picked again later
  e.target.value = ''
}

async function handleConfirmUpload() {
  if (!pendingFile) return
  setShowConfirm(false)
  try {
    setIsUploading(true)
    const fd = new FormData()
    fd.set('file', pendingFile)
    const res = await fetch(`/api/salary/bulk-import?month=${month}&year=${year}`, {
      method: 'POST',
      body: fd,
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      toast.error(json?.error ?? 'Upload failed')
      return
    }
    setSummary(json as BulkImportSummary)
    onImported()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Upload failed')
  } finally {
    setIsUploading(false)
    setPendingFile(null)
  }
}
```

Update the `return` JSX to add the Import button + dialog + hidden input:

```tsx
return (
  <>
    <div className="flex gap-2 items-center">
      <Button onClick={handleExport} disabled={isExporting} variant="outline">
        {isExporting ? 'Exporting...' : 'Export Salaries'}
      </Button>

      <input
        type="file"
        accept=".xlsx"
        ref={fileInputRef}
        onChange={handlePickFile}
        className="hidden"
      />
      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        variant="outline"
      >
        {isUploading ? 'Uploading...' : 'Import Salaries'}
      </Button>
    </div>

    <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apply bulk salary changes?</AlertDialogTitle>
          <AlertDialogDescription>
            Upload <span className="font-medium">{pendingFile?.name}</span> and apply
            changes for {monthLabels[month - 1]} {year}? Paid salaries will be skipped.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setPendingFile(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmUpload}>Upload</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
)
```

- [ ] **Step 2: Smoke-test**

Run: `npm run dev`
Navigate to `/salary`, click Import Salaries, pick the workbook downloaded earlier. Confirm upload.
Expected: toast or success returns. (Summary card not yet rendered — comes in Task 12.)
Verify network response in devtools: status 200 with JSON `summary` body.

- [ ] **Step 3: Commit**

```bash
git add src/components/salary/bulk-import-export.tsx
git commit -m "feat(salary): add import button with confirm dialog"
```

---

### Task 12: Summary card (with skipped-rows expander)

**Files:**
- Modify: `src/components/salary/bulk-import-export.tsx`

- [ ] **Step 1: Add summary card render**

In `src/components/salary/bulk-import-export.tsx`, add imports:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { X, ChevronDown } from 'lucide-react'
```

Below the existing `</div>` (the buttons wrapper) but still inside the fragment, add the summary card render:

```tsx
{summary && (
  <Card className="mt-4">
    <CardHeader className="flex flex-row items-center justify-between">
      <CardTitle>Bulk import complete</CardTitle>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSummary(null)}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </Button>
    </CardHeader>
    <CardContent className="space-y-3 text-sm">
      {(['Active', 'Partial Active'] as const).map((s) => {
        const c = summary.perSheet[s]
        return (
          <div key={s} className="flex justify-between">
            <span className="font-medium">{s} sheet</span>
            <span className="text-muted-foreground">
              {c.rows} rows · {c.updated} updated · {c.unchanged} unchanged · {c.skipped} skipped
            </span>
          </div>
        )
      })}

      {summary.skippedRows.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="link" className="px-0 h-auto">
              <ChevronDown className="h-4 w-4 mr-1" />
              View {summary.skippedRows.length} skipped row
              {summary.skippedRows.length === 1 ? '' : 's'}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <ul className="space-y-1 list-disc list-inside text-muted-foreground">
              {summary.skippedRows.map((r) => (
                <li key={`${r.sheet}-${r.rowNumber}`}>
                  Row {r.rowNumber} ({r.employeeName ?? 'Unknown'}, {r.sheet}):{' '}
                  {r.errors.join('; ')}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </CardContent>
  </Card>
)}
```

- [ ] **Step 2: Smoke-test the full flow**

Run: `npm run dev`
1. Pick a month with salaries.
2. Export the workbook.
3. Open it, edit a couple of statuses (one valid PROCESSING, one invalid like setting a PAID row's status to PENDING).
4. Save and re-import via the Import Salaries button.
5. Confirm in the page: summary card appears with per-sheet counts and the skipped row expander shows the PAID-immutable error.
6. Click the X to dismiss; confirm card disappears.
7. Reload the page; confirm the card stays gone.

- [ ] **Step 3: Commit**

```bash
git add src/components/salary/bulk-import-export.tsx
git commit -m "feat(salary): render dismissible summary card after bulk import"
```

---

### Task 13: Full test suite + typecheck + lint

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: No errors.

- [ ] **Step 3: Lint**

Run: `npx eslint src/lib/services/salary-bulk.ts src/app/api/salary/bulk-export/route.ts src/app/api/salary/bulk-import/route.ts src/components/salary/bulk-import-export.tsx`
Expected: No errors.

- [ ] **Step 4: Manual UAT walkthrough (HR perspective)**

In dev:
1. Generate salaries for a fresh month. Confirm Export downloads a workbook with two sheets.
2. Edit a row to move PENDING → PROCESSING. Edit another row's Other Additions to a positive number. Save.
3. Re-import. Summary should show `updated: 2, unchanged: rest, skipped: 0`.
4. Re-import the same workbook again. Summary should show `unchanged` for every row.
5. Edit a PAID row in the workbook to change its status. Re-import. Summary should report it skipped with `Paid salaries are immutable`.
6. Manually create a pending advance installment for a salary, then try to PROCESSING that salary via bulk. Summary should report it skipped with `Has pending advance installments`.
7. Edit Other Additions of the same row (no status change). Summary should report it `updated`.
8. Dismiss the summary card; reload page; confirm it doesn't return.

- [ ] **Step 5: Commit any final fixes**

If any UAT step revealed an issue, fix and commit.

```bash
git add ...
git commit -m "fix(salary-bulk): <specific fix>"
```

---

### Task 14: Open PR

- [ ] **Step 1: Push the branch**

Run:
```bash
git push -u origin feature/salary-bulk-import-export
```

- [ ] **Step 2: Open PR**

Run:
```bash
gh pr create --title "feat(salary): bulk import/export for monthly payroll" --body "$(cat <<'EOF'
## Summary
- Adds `Export Salaries` (xlsx, two sheets: Active / Partial Active) and `Import Salaries` to the salary processing page.
- Per-row partial success: HR can change Status, Other Additions, Other Deductions in bulk.
- Paid salaries are immutable; pending advance installments block PROCESSING/PAID transitions.
- Net salary recomputed on every adjustment using `computeNetFromStoredSalary`.
- Dismissible summary card shows updated / unchanged / skipped counts per sheet with row-level error detail.

Spec: `docs/superpowers/specs/2026-05-07-salary-bulk-import-export-design.md`
Plan: `docs/superpowers/plans/2026-05-07-salary-bulk-import-export.md`

## Test plan
- [x] Unit tests for validation, diff, transition guard, recompute
- [x] Integration tests for `applyBulkImport` (DB)
- [x] Round-trip test (export → parse → import → all unchanged)
- [x] Route integration test (auth, no-salaries, round-trip, invalid workbook)
- [ ] Manual UAT: PAID immutable, pending installment guard, adjustment-only edits with installments

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage check:**
  - Architecture (spec §"Architecture") → Tasks 1, 8, 9, 10. ✓
  - Sheet schema (spec §"Sheet Schema") → Task 6 (12 columns A–L; status dropdown via data-validation; sheet protection). ✓
  - Import processing logic 1–8 (spec §"Import Processing Logic") → Task 5. ✓
  - Validation / row error catalog (spec §"Validation, Edge Cases, Error Catalog") → Tasks 2, 5. ✓
  - File-level errors (workbook, no recognized sheets, max rows, no salaries) → Tasks 7, 8, 9. ✓
  - API contracts → Tasks 8, 9. ✓
  - Frontend UX (Export, Import, confirm dialog, summary card, dismiss) → Tasks 10, 11, 12. ✓
  - Testing → Tasks 2, 3, 4, 5, 7, 9, 14. ✓

- **Placeholder scan:** No "TBD" / "TODO" / "implement later" / handwave-style steps. Every code step shows the code.

- **Type consistency:** `SalaryStatus`, `BulkRowInput`, `NormalizedRowEdit`, `BulkImportSummary`, `BulkSheetName`, `BulkRowFailure` are defined in Task 1 and used consistently. `applyBulkImport` returns `BulkImportSummary`; `parseBulkWorkbook` returns `ParseResult`; both types are introduced in the task that defines them and reused unchanged later.

- **Known runtime caveat (out of plan scope):** `maxDuration = 300` requires a Vercel Pro tier. The plan ships with this value as the spec specifies. If the build/deploy fails, drop to 60 and revisit.
