# Professional Tax Deduction & Recurring Deductions Framework

**Date:** 2026-05-07
**Status:** Design approved, ready for implementation plan

## Problem

Indian payroll requires a monthly Professional Tax (PT) deduction of ₹200 for most months and ₹300 in February for employees with base salary at or above ₹10,000. The current `Salary` table only supports flat scalar deductions (`otherDeductions`, `advanceDeduction`), with no concept of recurring statutory components and no per-employee enrollment for items like PT, PF, or ESI.

This design adds PT now and lays the groundwork for PF/ESI (and other future recurring deductions) without prematurely generalizing the rest of the salary model.

## Goals

- Auto-deduct PT during salary generation for opted-in employees with base salary ≥ ₹10,000.
- ₹200 every month except February, where it is ₹300.
- Per-employee opt-in toggles for PT, PF, ESI (PF and ESI are flag-only for now; deduction logic ships later).
- Bulk-edit opt-in flags via Excel upload, matching the existing user import/export pattern.
- Itemized "Statutory Deductions" line on the payslip.
- Each generated salary is an immutable snapshot — changing opt-in flags later must not alter past payslips.

## Non-Goals

- PF / ESI deduction calculation. Only the opt-in flags are added now; logic is a future change.
- Bonus itemization. `otherBonuses` stays a flat scalar.
- Migrating existing `otherDeductions` values into the array. The scalar field stays as-is for ad-hoc HR adjustments.
- Configurable PT amount or threshold via an admin UI. The values (₹200 / ₹300 / ₹10,000) are constants in code.
- Pro-rating PT by attendance. PT is a flat deduction. HR can credit it back manually via `otherBonuses` when needed.

## Data Model

### `User` — three new boolean flags

```prisma
optInPT   Boolean @default(false) @map("opt_in_pt")
optInPF   Boolean @default(false) @map("opt_in_pf")
optInESI  Boolean @default(false) @map("opt_in_esi")
```

Pure config — they declare enrollment for each statutory component. The flag itself contains no business logic; eligibility rules (e.g., the ₹10,000 PT threshold) are enforced at salary generation.

### `Salary` — new JSON snapshot column

```prisma
recurringDeductions Json? @map("recurring_deductions")
```

Format:

```json
[
  { "code": "PT", "name": "Professional Tax", "amount": 200 }
]
```

This is a **frozen snapshot** of what was applied that month. Editing a user's opt-in flag after the salary is generated does NOT mutate this field; only re-running salary generation does.

### Why two layers (flag + snapshot)?

The flag is mutable config that drifts over time. The JSON array is an immutable record of what actually happened. Conflating the two is how payroll systems break.

### Existing fields are untouched

`otherBonuses`, `otherDeductions`, `advanceDeduction`, `overtimeBonus`, `installments` keep their current scalar / relational semantics. No data migration is required for existing rows.

## Salary Generation Logic

In `src/lib/services/salary-calculator.ts`:

### Helper

`computeRecurringDeductions(user, month, year): Array<{code, name, amount}>`

For now:

```ts
const entries = []
if (user.optInPT && user.salary >= 10000) {
  entries.push({
    code: "PT",
    name: "Professional Tax",
    amount: month === 2 ? 300 : 200,
  })
}
// PF / ESI: not yet implemented — added later
return entries
```

### Wiring

`calculateSalary` computes the array, sums it as `recurringDeductionTotal`, and folds it into the existing net salary calculation.

`createOrUpdateSalary` writes the array to `Salary.recurringDeductions` on create, and recomputes it on update (since opt-in flags or base salary may have changed between generations).

### Net salary formula

```
netSalary = baseSalaryEarned + otherBonuses
          - advanceDeduction
          - otherDeductions
          - sum(recurringDeductions)
```

### Eligibility rule

PT applies if and only if `user.optInPT === true && user.salary >= 10000`. The threshold is strict at 10,000 inclusive. Salaries below ₹10,000 never get PT, regardless of the flag.

### Pro-rating

PT is a flat deduction. An employee with half-month attendance still has PT cut at full ₹200 (or ₹300 in Feb). HR may credit it back manually via the existing `otherBonuses` adjustment if needed.

### Backfill behavior

- **Already PAID salaries**: untouched.
- **PENDING salaries existing at rollout**: when HR re-runs salary generation or saves the salary, the new field is computed and applied. No automatic mass backfill.
- **New salaries**: PT is applied automatically going forward.

## UI

### A. Per-user opt-in (inline on user detail page)

A new "Statutory Deductions" section in the existing user edit form with three checkboxes:

- ☐ Professional Tax (PT) — editable
- ☐ Provident Fund (PF) — disabled, "coming soon" tooltip
- ☐ ESI — disabled, "coming soon" tooltip

Permissions: HR + MANAGEMENT only (matching existing salary-related permission gates).

### B. Bulk Excel import/export — new page

Route: `/users/deduction-settings`. HR / MANAGEMENT only.

List view columns: Employee Number, Name, Salary, PT (Y/N), PF (Y/N), ESI (Y/N).

Two actions:

- **Download Excel** — exports current settings for all active users. Excel structure follows the existing `user-data-import-export.tsx` pattern with starred required columns:

  ```
  UID | Employee Number | Name | Salary | PT* | PF* | ESI*
  ```

- **Upload Excel** — uploads an edited file. Each row is validated:
  - UID must match an existing user
  - PT/PF/ESI must be `Y`/`N` or `TRUE`/`FALSE`

  Validation errors are surfaced row-by-row before commit. On success, all updates apply in a single transaction.

A separate, focused page (rather than extending the existing user import/export) prevents accidental overwrite of unrelated user fields and keeps each tool single-purpose.

## Payslip / Salary Detail Display

### Salary detail page & payslip template

A new "Statutory Deductions" sub-section between "Other Deductions" and "Net Salary":

```
Base Salary Earned          ₹15,000
Overtime Bonus              ₹500
Other Bonuses               ₹0
────────────────────────────
Gross Earnings              ₹15,500

Advance EMI                 ₹1,000
Other Deductions            ₹0
Statutory Deductions:
  Professional Tax          ₹200
────────────────────────────
Net Salary                  ₹14,300
```

If `recurringDeductions` is null or empty (legacy salaries; user not opted in), the entire sub-section is hidden — no empty header.

### Salary list / stats table

The recurring deductions total folds into the existing "Total Deductions" column. No new column. Detail view shows the breakdown.

### Payslip PDF / email export

Same itemized treatment, reading from `recurringDeductions`. Falls back to nothing when the field is absent.

## Permissions

All new surfaces (per-user toggle, bulk Excel page, bulk update API) require HR or MANAGEMENT role. This matches existing salary route guards (e.g., `/api/salary/[id]/adjustment`).

## Testing

### Unit tests (PT rule)

| Scenario | Expected |
|---|---|
| `optInPT=true, salary=9999` | no PT |
| `optInPT=true, salary=10000` | PT ₹200 |
| `optInPT=true, salary=10000, month=2` | PT ₹300 |
| `optInPT=false, salary=20000` | no PT |
| `optInPT=true, salary=20000, half-month attendance` | PT ₹200 (flat, not pro-rated) |

### Integration

- `calculateSalary` → net salary correctly subtracts `recurringDeductions` total alongside `advanceDeduction` and `otherDeductions`.
- `createOrUpdateSalary` → `recurringDeductions` JSON is written on create and refreshed on update.

### Bulk upload

- Invalid UID → row error, whole batch rejected before commit.
- Invalid Y/N value → row error, whole batch rejected.
- Valid file → all rows update in a single transaction.

### Snapshot integrity

Toggling `optInPT` after a salary is generated does NOT mutate that salary's `recurringDeductions` JSON. Only re-running generation does.

## Rollout Sequence

1. Schema migration (3 User boolean flags + 1 Salary JSON column). Additive, defaults are `false` / `null`. No downtime.
2. Calculator changes deploy. No-op until any user is opted in.
3. UI surfaces ship: per-user toggle and bulk import/export page.
4. HR bulk-uploads the initial opt-in list (one-time bootstrap).
5. Next salary generation cycle applies PT automatically.

No separate feature flag — the opt-in flag itself is the kill switch. If something goes wrong, HR un-checks PT on affected users and regenerates the salary.

## Open Items for the Implementation Plan

- Identify the exact list of payslip render sites (detail page, PDF route, email template) so all three are updated together.
- Confirm the route path for the new bulk page (`/users/deduction-settings` proposed).
- Confirm whether PF/ESI checkboxes should be hidden vs. disabled — this design uses disabled with "coming soon" tooltip.
