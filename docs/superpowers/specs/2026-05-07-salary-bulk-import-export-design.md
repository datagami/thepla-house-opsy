# Salary Bulk Import / Export — Design Spec

**Date:** 2026-05-07
**Status:** Approved (pending implementation plan)
**Owner:** HR/Payroll workflow

## Problem

HR processes payroll for a large monthly cohort. After salaries are generated, each salary card today must be opened individually to: change status (`PENDING` → `PROCESSING` → `PAID`), and adjust `Other Additions` / `Other Deductions`. At ~200 employees this is a click-heavy, error-prone task and is the current source of HR friction.

## Goal

Add a bulk import / export workflow on the salary processing page so HR can:

1. Export the current month's generated salaries as an `.xlsx` workbook split by user status.
2. Edit `Status`, `Other Additions`, `Other Deductions` in bulk.
3. Re-upload the workbook and have the server apply per-row changes with a per-row partial-success model.
4. See a one-time, dismissible summary card showing what was updated, unchanged, and skipped (with reasons).

`PAID` salaries are immutable — any attempt to mutate a paid salary's editable fields must fail at the row level.

## Non-Goals

- Editing `baseSalary` via the sheet (locked).
- Editing referrals or approving advance installments via the sheet (kept in existing per-card flows; the export only surfaces totals so HR can plan).
- Activity logging for bulk operations. The existing per-card flows do not log `SALARY_UPDATED` / `SALARY_STATUS_CHANGED` either; we stay consistent. Audit logging may be added later as a separate, deliberate cross-cutting change.
- Persisted server-side import history. Summary is component-local only.
- Streaming progress indicator for large uploads.

## Architecture

### New files

- `src/app/api/salary/bulk-export/route.ts` — `GET ?year=&month=` → `.xlsx` download.
- `src/app/api/salary/bulk-import/route.ts` — `POST` multipart form-data → JSON summary.
- `src/components/salary/bulk-import-export.tsx` — UI component with Export button, Import button (file picker + confirm sheet), and the dismissible summary card. Mounted in `src/components/salary/salary-management.tsx`.
- `src/lib/services/salary-bulk.ts` — pure service:
  - `buildBulkWorkbook(month, year): Promise<Buffer>`
  - `applyBulkImport(input, ctx): Promise<BulkImportSummary>`
- `src/lib/services/salary-bulk.test.ts` — unit tests for the service.
- `src/app/api/salary/bulk-import/__tests__/route.test.ts` — integration tests for the route.

### Reuses

- `computeNetFromStoredSalary` from `src/lib/services/salary-math.ts` for net-salary recompute.
- `sumRecurringDeductions` from `src/lib/services/recurring-deductions.ts`.
- The status-transition + advance-installment guard logic currently in `src/app/api/salary/bulk-update-status/route.ts`. We extract that guard into `salary-bulk.ts` (or an adjacent helper) so the new bulk-import path and the existing `bulk-update-status` route share one source of truth. This is a small, targeted refactor justified by the new feature.
- `exceljs` (already a dependency; same library used by `src/app/api/reports/attendance/export/route.ts`).
- `Alert`, `Card`, and shadcn `Sheet`/`Collapsible` for the UI.

### Auth & runtime

- Both routes gate on `session.user.role ∈ ['HR', 'MANAGEMENT']`. Non-matching → 401.
- Both routes set:

```ts
export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'
```

Body size limit on the import route raised to ~10 MB to fit a 500-row formatted xlsx.

### Pre-conditions

If `(month, year)` has zero salaries, both endpoints return 400 with `No salaries exist for this month`. The page disables the Export button in this case.

## Sheet Schema

One workbook per month: `salaries-{year}-{month}.xlsx`. Two worksheets: `Active` and `Partial Active`. Identical columns.

| # | Column | Type | Editable | Source / Notes |
|---|---|---|---|---|
| A | salaryId | string | No (locked) | `Salary.id`. Match key on import. Hidden-ish (kept narrow); deleting the column → file-level error. |
| B | Employee # | int | No (locked) | `User.employeeNumber` |
| C | Name | string | No (locked) | `User.name` |
| D | Branch | string | No (locked) | `User.branch.name` |
| E | Base Salary | number | No (locked) | `Salary.baseSalary` — read-only reference; ignored on import. |
| F | Present Days | number | No (locked) | `Salary.presentDays` |
| G | Status | enum | **Yes** | `PENDING` \| `PROCESSING` \| `PAID` \| `FAILED`. Cell carries an Excel data-validation dropdown. |
| H | Other Additions | number | **Yes** | Maps to `Salary.otherBonuses`. Must be `≥ 0`. |
| I | Other Deductions | number | **Yes** | Maps to `Salary.otherDeductions`. Must be `≥ 0`. |
| J | Statutory Deductions | number | No (locked) | Sum of `Salary.recurringDeductions` (PT, PF, ESI, etc.) computed via `sumRecurringDeductions`. Informational — helps HR understand why the net came out where it did. |
| K | Net Salary (current) | number | No (locked) | Reference; recomputed server-side on import. |
| L | Pending Referrals (Total) | number | No (locked) | Sum of `bonusAmount` across this user's unpaid, non-archived referrals eligible by **end of the previous month** (referrals are paid one month after eligibility — matches `process-referrals` route). `0` if none. |
| M | Pending Installments (Total) | number | No (locked) | Sum of `amountPaid` across `PENDING` `AdvancePaymentInstallment` rows attached to this salary. `0` if none. |

### Sheet split

- `Active` → `User.status = ACTIVE`
- `Partial Active` → `User.status = PARTIAL_INACTIVE`
- Salaries belonging to users in any other `UserStatus` are excluded from the export.

### Sheet protection

ExcelJS cell protection marks all locked columns read-only. Status column gets a data-validation dropdown of the four enum values. This is UX guidance only — the server re-validates everything on import.

### Sheet detection on import

- Look up worksheets by name: `Active`, `Partial Active`.
- A workbook with at least one of the two is accepted; the missing one is treated as "HR didn't edit that group".
- Workbook with neither → file-level error `No recognized sheets`.
- Extra worksheets are ignored.

## Import Processing Logic

For each row, in order, inside a per-row transaction (`prisma.$transaction(async tx => { ... })`). Partial success: row failures are collected and reported; other rows continue.

1. **Resolve salary.** `tx.salary.findUnique({ where: { id: row.salaryId }, include: { installments: true } })`. Missing → row error `Salary not found`.
2. **Cross-check ownership.** Confirm the resolved salary's `(month, year)` matches the upload's month/year context (passed as query params). Mismatch → row error `Salary belongs to a different month`. Guards against pasted rows from a different file.
3. **Diff against DB.** Compute the set of changed editable fields ⊆ `{status, otherBonuses, otherDeductions}`. If empty → mark row `unchanged`, no write, no further work.
4. **Validate values.**
   - `status ∈ SalaryStatus` enum (after trim, if non-empty).
   - `otherBonuses` and `otherDeductions` finite and `≥ 0`.
   - Empty cell for either amount → coerce to `0` (lets HR clear a value).
   - Empty status cell → treat as "no change" (not a validation failure).
   - Any failure → row error with field name and reason.
5. **Status transition guard** (only when status changes).
   - Current status `PAID` and any editable field differs → row error `Paid salaries are immutable`. **Hard rule.**
   - Target status `PROCESSING` or `PAID` and any `installment.status === 'PENDING'` exists → row error `Has pending advance installments`.
   - All other transitions allowed (matches the existing per-card flow). `→ FAILED` does **not** trigger the installment guard, by design.
6. **Recompute net salary** (whenever any editable field changes). Use `computeNetFromStoredSalary` with the new `otherBonuses` / `otherDeductions` and the salary's existing `baseSalary`, `presentDays`, `overtimeDays`, `halfDays`, `leaveSalary`, `advanceDeduction`, and `recurringDeductions`. `baseSalary` is read from the DB row — the sheet's Column E is ignored even if HR edits it. When the new status is `PROCESSING`, also re-derive `advanceDeduction` from APPROVED installments using the same helper as `bulk-update-status`.
7. **Write.** `tx.salary.update({ where: { id }, data: { status?, otherBonuses?, otherDeductions?, netSalary, advanceDeduction?, paidAt? } })`. Set `paidAt = new Date()` on transitions into `PAID`. Clear `paidAt` on transitions out of `PAID` (defensive — unreachable given the immutable rule).
8. **No activity log.** Consistent with existing per-card and `bulk-update-status` flows.

### Per-row error structure (returned in summary)

```ts
{
  rowNumber: 5,           // spreadsheet row index (1-based, including header)
  sheet: 'Active' | 'Partial Active',
  salaryId: 'cl...' | null,
  employeeName: 'Jane D.' | null,
  errors: ['Paid salaries are immutable']
}
```

### Concurrency

Each row runs its own short transaction. We do not lock the whole month. Expected throughput at ~200 rows is comfortably under the 300s timeout.

## Validation, Edge Cases, Error Catalog

### File-level errors (HTTP 400, no summary card; toast on client)

| Error | Trigger |
|---|---|
| `Invalid workbook` | File is not a valid `.xlsx` / exceljs cannot parse it. |
| `No recognized sheets` | Neither `Active` nor `Partial Active` worksheet present. |
| `No salaries exist for this month` | DB has zero salaries for `(month, year)`. |
| `Workbook exceeds 2000 rows; split and re-upload` | Total rows across both sheets > 2000. |
| `Unauthorized` | Caller is not HR / MANAGEMENT. |

### Row-level errors (collected, row skipped, others continue)

| Error | Trigger |
|---|---|
| `salaryId column missing or empty` | Column A blank or removed for this row. |
| `Duplicate salaryId in upload` | Same `salaryId` appears more than once across the workbook; first occurrence wins. |
| `Salary not found` | `Salary.id` does not exist. |
| `Salary belongs to a different month` | Resolved salary's `(month, year)` ≠ upload context. |
| `Invalid status value` | Cell value not in `SalaryStatus` enum. |
| `Other Additions must be a non-negative number` | NaN, negative, or non-finite. |
| `Other Deductions must be a non-negative number` | NaN, negative, or non-finite. |
| `Paid salaries are immutable` | Current status `PAID` and any editable field differs. |
| `Has pending advance installments` | Target status `PROCESSING`/`PAID` and pending installments exist. |

### Edge cases handled

- Empty `Other Additions` / `Other Deductions` cell → `0`.
- Empty `Status` cell → no change.
- Whitespace in `Status` → trimmed before validation.
- Excel "number-as-string" amounts → coerced via `Number()`; `NaN` → row error.
- Duplicate `salaryId` rows → first wins, others flagged.
- `salaryId` for a user no longer `ACTIVE` / `PARTIAL_INACTIVE` → still processed (the salary record is the source of truth for the month; user-status changes after generation should not lock HR out of finalization).
- Sheet swap (HR moves an Active row into the Partial Active sheet) → still processed; we resolve by `salaryId`, not sheet placement.

## API Contracts

### `GET /api/salary/bulk-export?year=&month=`

- Auth: HR / MANAGEMENT.
- Pre-condition: at least one salary exists for `(month, year)`. Otherwise 400.
- Response: `200 application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` with `Content-Disposition: attachment; filename="salaries-{year}-{month}.xlsx"`.

### `POST /api/salary/bulk-import?year=&month=`

- Auth: HR / MANAGEMENT.
- Body: `multipart/form-data` with a single `file` field (`.xlsx`).
- Pre-condition: at least one salary exists for `(month, year)`. Otherwise 400.

Success response (200):

```json
{
  "ok": true,
  "month": 5,
  "year": 2026,
  "perSheet": {
    "Active":         { "rows": 45, "updated": 38, "unchanged": 5, "skipped": 2 },
    "Partial Active": { "rows": 12, "updated": 10, "unchanged": 2, "skipped": 0 }
  },
  "skippedRows": [
    { "rowNumber": 7,  "sheet": "Active", "salaryId": "cl...", "employeeName": "John D.",  "errors": ["Paid salaries are immutable"] },
    { "rowNumber": 19, "sheet": "Active", "salaryId": "cl...", "employeeName": "Asha M.",  "errors": ["Has pending advance installments"] }
  ]
}
```

File-level error response (400):

```json
{ "ok": false, "error": "No recognized sheets" }
```

## Frontend UX

`src/components/salary/bulk-import-export.tsx` is mounted in `salary-management.tsx` next to the existing Generate / Process Referrals / Download ENET / Download Report buttons. It owns:

- `summary: BulkImportSummary | null` — local state.
- `isUploading: boolean`, `isExporting: boolean`.

### Buttons

- **Export Salaries** — disabled when month has zero salaries. Click → `GET /api/salary/bulk-export?year=...&month=...` → triggers a browser download. Mirrors the pattern used by the existing `DownloadReportButton`.
- **Import Salaries** — opens a hidden `<input type="file" accept=".xlsx">`. On file pick, opens a shadcn `Sheet` confirm dialog: *"Upload and apply changes for {Month Year}?"*. Confirm → POST multipart form-data, button shows spinner, all other actions on the page disabled until completion. On success → set `summary` state and call the parent's `setRefreshKey(prev => prev + 1)` so `SalaryList` reloads.

### Summary card

Rendered above `SalaryList` whenever `summary !== null`. Shows per-sheet totals (rows, updated, unchanged, skipped) and a `Collapsible` "View N skipped rows" expander that lists each `{ rowNumber, sheet, employeeName, errors }`. Card has an `[X]` dismiss button which sets `summary = null`. State is component-local; navigating away or reloading the page also clears it. No global toast on success — the card is the success notification.

On file-level error the client shows a toast and does not render the summary card.

## Testing

### Unit — `src/lib/services/salary-bulk.test.ts`

- Status transitions: each allowed move; PAID → anything fails; `→ PROCESSING` blocked by pending installments; `→ FAILED` not blocked.
- Recompute: changing `otherBonuses` updates `netSalary` per `computeNetFromStoredSalary`; empty cell → `0`.
- Diff detection: row with no actual changes → marked `unchanged`, no write.
- Validation: negative amount, NaN, invalid status enum, missing `salaryId` each return the documented row error.
- Base Salary in sheet differs from DB → ignored, recompute uses DB value.
- Duplicate `salaryId` in same workbook → first wins, second flagged.

### Integration — `src/app/api/salary/bulk-import/__tests__/route.test.ts`

- Build a real workbook in memory, POST it, assert summary JSON shape and resulting DB state.
- Auth gate: non-HR session → 401.
- File-level errors: corrupt xlsx, no recognized sheets, no salaries for the month — each returns 400 with the documented error.
- Mixed batch: 5 valid + 2 invalid rows → 200 with `updated: 5, skipped: 2` and DB shows only the 5 writes.
- Idempotency: re-uploading the same workbook → all rows `unchanged`.

### Round-trip

Generate fixture salaries → call `bulk-export` → parse → POST back unchanged → assert all rows reported `unchanged` and DB unchanged. Catches schema drift between export and import.

### Manual UAT (HR)

- Generate salaries, export, edit a few statuses + numbers across both sheets, re-upload. Confirm summary card matches expectations and `SalaryList` reflects new values.
- Try to change a `PAID` row → confirm row is skipped with `Paid salaries are immutable`.
- Try to move a row with pending installments to `PROCESSING` → confirm skipped with `Has pending advance installments`.
- Dismiss the summary card → reload page → confirm it does not return.

## Open Questions

None outstanding. Behavior of `→ FAILED` w.r.t. pending installments is intentionally aligned with the existing per-card flow (no guard); revisit if HR reports a real-world issue.
