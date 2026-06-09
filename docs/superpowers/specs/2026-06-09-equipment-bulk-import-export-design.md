# Equipment Bulk Import / Export — Design Spec

**Date:** 2026-06-09
**Status:** Approved design, pending implementation plan
**Module:** Maintenance (Equipment items). Builds on the merged maintenance module (PR #52).

## 1. Purpose

Let managers and management bulk-manage the **equipment item registry** via Excel:
export the current items, edit them in a spreadsheet, and re-import to update existing
items and create new ones in one pass. This speeds up onboarding a new outlet's
equipment list and making sweeping edits (e.g. adjusting frequencies/reminders across
many items).

Scope is the **item registry only** — names, categories, schedules, etc. Maintenance
records (cost/vendor/bills/photos) are **out of scope** and stay managed in the app.

## 2. Format & round-trip model

- **XLSX** (via `exceljs`), matching the app's existing bulk patterns (salary
  bulk-import/export, attendance report export). No CSV in v1.
- A single worksheet named **"Items"**.
- The first column is **Item ID** — the upsert key. It is **locked** (read-only) in the
  exported sheet.
  - Row **with** an Item ID → **update** that existing item.
  - Row **without** an Item ID → **create** a new item.
- The export **is** the template: with zero items in scope, it produces an empty sheet
  with the header row, the category dropdown, and the instructions still present.

### 2.1 Columns

| # | Column header | Maps to | Import rule |
| - | ------------- | ------- | ----------- |
| A | `Item ID` | `Equipment.id` | Upsert key. Blank = create. Locked in export; never hand-edit. |
| B | `Name` | `name` | **Required**, non-empty (trimmed). |
| C | `Category` | `category` | **Required**. Cell dropdown of category labels; accepts the label ("Fire Safety") or the enum ("FIRE_SAFETY"), case-insensitive. |
| D | `Outlet` | `branchId` (via `Branch.name`) | Branch **name** (unique). Manager: ignored — forced to their own outlet. Management: **required for new rows**; resolved to a real branch or the row is skipped. |
| E | `Location` | `location` | Optional. |
| F | `Service every (months)` | `frequencyMonths` | Optional. Blank or positive integer. |
| G | `Reminder lead (days)` | `reminderLeadDays` | Optional. Integer 0–365. Default **15** when blank on a new row. |
| H | `Status` | `status` | Optional. `ACTIVE` / `RETIRED` (case-insensitive). Default `ACTIVE` on new rows. |
| I | `Next due date` | `nextDueDate` | Optional. Parseable date (treated as IST calendar day). Blank allowed. |
| J | `Notes` | `notes` | Optional. |
| K | `Last serviced` | `lastServiceDate` | **Read-only reference.** Written on export, **ignored** on import (it is derived from maintenance records). |

> Importable fields: B, C, D, E, F, G, H, I, J. Column A is the key; column K is ignored.

## 3. Access & scoping

- Both import and export are gated on the **`equipment.manage`** feature (BRANCH_MANAGER
  + MANAGEMENT). **HR has no bulk access** (not even export).
- **BRANCH_MANAGER (own outlet only):**
  - Export contains only their outlet's items.
  - Import: the `Outlet` column is ignored — every new row is forced to their own
    `branchId`. A row whose `Item ID` belongs to a **different** branch is skipped with
    an error ("Item is not in your outlet"). They can never read or modify another
    outlet's items.
- **MANAGEMENT (all outlets):**
  - Export contains all items across all outlets.
  - Import: the `Outlet` name is resolved to a `branchId` (required for new rows; for an
    `Item ID` row the existing item's branch is used and `Outlet` changes are ignored —
    items cannot be moved between outlets, consistent with the single-item edit API).
- Server routes are the authority; the UI buttons are merely hidden when the user lacks
  `equipment.manage`.

## 4. Import behavior (partial, forgiving)

1. Accept an `.xlsx` upload (multipart FormData, field `file`). Reject non-xlsx / files
   over a sane size with a 400.
2. Parse the "Items" sheet with `exceljs`. Enforce a **2000-row cap** (reject with a
   clear message above it).
3. For each data row, `validateAndNormalizeRow`:
   - Trim/parse cells; coerce numbers/dates; map category label↔enum; resolve `Outlet`
     name → branch (respecting role scope).
   - Reuse the existing zod schemas where natural: `equipmentCreateSchema` (new rows)
     and `equipmentUpdateSchema` (id rows) for field-level validation.
   - Apply outlet-scope checks (above).
   - Collect row-level errors into `skipped: [{ row, name, errors[] }]`.
4. For valid rows:
   - **Create** (no id): insert with `createdById = session user`, deriving
     `nextDueDate` from the provided value or `frequencyMonths` (same rule as the
     single-create API).
   - **Update** (id): load the item (must be in the user's scope); **diff** the
     importable fields against the DB. If nothing changed → count as **unchanged**
     (no write). Otherwise update only the changed fields.
   - Status changes via bulk import set `ACTIVE`/`RETIRED` **but do NOT trigger the
     archive blob-deletion side effect** (that destructive flow stays behind the
     explicit Archive dialog only). A bulk `RETIRED` just flips the flag.
5. Write **one** activity-log entry summarizing the run (reuse
   `ActivityType.EQUIPMENT_UPDATED` with metadata `{ bulk: true, created, updated,
   unchanged, skipped }`) — no new enum, no migration.
6. **Response summary:**
   ```json
   {
     "ok": true,
     "created": 12,
     "updated": 5,
     "unchanged": 30,
     "skipped": [
       { "row": 7, "name": "Chest Freezer", "errors": ["Unknown category 'Freezr'"] },
       { "row": 9, "name": "", "errors": ["Name is required"] }
     ]
   }
   ```

Partial success: valid rows are saved even if others are skipped. The user fixes the
reported rows and re-uploads (re-importing unchanged rows is a no-op thanks to the diff).

## 5. Export behavior

- `GET /api/equipment/bulk-export` → an `.xlsx` of all items **in the caller's scope**
  (Manager = own outlet; Management = all), both ACTIVE and RETIRED, ordered by outlet
  then name.
- Build with `exceljs`: bold header row, a frozen header, the **Item ID** column locked,
  a **Category** dropdown (data-validation list of labels), sensible column widths, and a
  short instructions note (e.g. in a header comment or a second tiny "How to use" sheet).
- Dates (`Next due date`, `Last serviced`) rendered as IST calendar dates (matching
  `formatDateIST`).
- Returns the buffer with:
  ```
  Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  Content-Disposition: attachment; filename="equipment-<scope>-<yyyy-mm-dd>.xlsx"
  ```

## 6. Components & files

**New:**
- `src/lib/services/equipment-bulk.ts` — the testable core:
  - `EQUIPMENT_BULK_COLUMNS` / header constants.
  - `buildEquipmentWorkbook(items, opts)` → `ExcelJS.Workbook` (export).
  - `parseEquipmentWorkbook(buffer)` → `{ rows: RawRow[] }` (raw cell extraction).
  - `validateAndNormalizeRow(raw, ctx)` → `{ ok, value } | { ok:false, errors }`
    where `ctx` carries role, scoped branchId, and a branch-name→id map.
  - `diffEquipment(existing, incoming)` → changed-field set (for unchanged detection).
  - `applyBulkImport({ rows, user, prisma })` → the summary object (orchestration).
- `src/app/api/equipment/bulk-export/route.ts` — GET, role/scope-gated, returns xlsx.
- `src/app/api/equipment/bulk-import/route.ts` — POST FormData, role/scope-gated,
  returns the summary.
- `src/components/equipment/bulk-import-export.tsx` — client toolbar component:
  "Export" (downloads the xlsx) + "Import" (hidden file input → confirm dialog → POST →
  summary card with a collapsible skipped-rows list). Mirrors
  `src/components/salary/bulk-import-export.tsx`. Uses sonner toasts + shadcn Dialog/Card/
  Collapsible.

**Modified:**
- `src/app/(auth)/equipment/page.tsx` — render `<BulkImportExport>` in the page header
  (next to "Add Item"), only when `hasAccess(role, "equipment.manage")`.

**Reused (unchanged):**
- `exceljs` (already a dependency), the existing zod schemas in
  `src/lib/validations/equipment.ts`, `equipmentWhereForRole` / `canManageBranch`,
  `computeNextDueDate`, `formatDateIST`, `hasAccess`, `logEntityActivity`.

## 7. Testing

- **Unit (`equipment-bulk.ts`)**:
  - `validateAndNormalizeRow`: required-name, category label/enum/invalid, outlet
    resolution + scope rejection (manager cross-outlet), numeric/date coercion, blanks →
    defaults, status parsing.
  - `buildEquipmentWorkbook` → `parseEquipmentWorkbook` round-trip preserves values and
    the Item ID column.
  - `diffEquipment` detects changed vs unchanged correctly.
- **DB-integration (import route)** (mirrors `src/app/api/equipment/__tests__/route.test.ts`):
  - manager import creates/updates only in own outlet; a row for another outlet is
    skipped with an error; an `Item ID` from another branch is rejected.
  - partial: a file with one bad row imports the good rows and reports the bad one.
  - unchanged rows are not double-counted as updates.
- Export route: a smoke test asserting 200 + the xlsx content-type and that a known item
  appears.

## 8. Out of scope (v1 / YAGNI)

- CSV format.
- Importing/exporting maintenance records, photos, or bills.
- Moving items between outlets via import (branch is immutable on update).
- Triggering archive blob-deletion from a bulk `RETIRED` (stays behind the Archive dialog).
- Async/queued processing for very large files (2000-row cap is sufficient).
- Undo/rollback of an import (partial writes are intentional; re-import to correct).

## 9. Success criteria

- A manager exports their outlet's items, edits frequencies/adds rows in Excel, re-imports,
  and sees `created`/`updated`/`unchanged`/`skipped` counts with clear per-row errors —
  scoped strictly to their outlet.
- Management can do the same across all outlets, with `Outlet` resolving branches for new
  rows.
- HR sees no bulk controls and the routes reject them.
- Invalid rows never block valid ones; re-importing an unchanged export is a clean no-op.
