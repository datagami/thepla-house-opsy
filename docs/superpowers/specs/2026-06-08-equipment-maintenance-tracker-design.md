# Equipment & Maintenance Tracker — Design Spec

**Date:** 2026-06-08
**Status:** Approved design, pending implementation plan
**Module owner roles:** Branch Manager, Management (HR read-only)

## 1. Purpose

Digitize and replace the paper "Maintenance Sheet" (Thepla House by Tejal's Kitchen)
used per outlet. Track all maintainable items in each outlet — equipment (fire
extinguisher, refrigeration, kitchen equipment, etc.) and recurring outlet services
(pest control, deep cleaning) — along with a full history of service events, their
cost, bills, and photos. Surface upcoming and overdue maintenance to managers and
management so nothing lapses.

This module is a direct digital upgrade of an existing paper form, so the vocabulary
and columns intentionally mirror that sheet.

### Source paper form columns → system mapping

| Paper sheet column      | In the system                                            |
| ----------------------- | -------------------------------------------------------- |
| Branch Name + Date      | Auto-captured (outlet + service date)                    |
| Kitchen Area            | `Equipment.location` (e.g. Hot Kitchen, Cold Storage)    |
| Equipment Name          | `Equipment.name`                                         |
| Issue / Observation     | `MaintenanceRecord.issue`                                |
| Maintenance Type        | `MaintenanceRecord.maintenanceType`                      |
| Technician / Vendor     | `MaintenanceRecord.vendorName` + `vendorContact`         |
| Cost                    | `MaintenanceRecord.cost`                                 |
| Status                  | `MaintenanceRecord.status`                               |
| Remarks                 | `MaintenanceRecord.remarks`                              |
| Checked By / Manager    | `MaintenanceRecord.loggedById` (from logged-in user)     |

## 2. Core model: two layers

The key design decision is a **two-layer model**:

1. **Equipment Registry** — the master list of maintainable items per outlet. This
   layer holds the schedule and **drives reminders** via a `nextDueDate`.
2. **Maintenance Records** — one row per service event (the digitized paper-sheet
   row). Holds cost, bill, photos, vendor, issue, and updates its parent item's
   schedule on save.

"Pest control" is modeled as an `Equipment` item with `category = PEST_CONTROL` whose
`location` is the outlet generally — i.e. everything is a unified "maintainable item"
distinguished by a `category` field. One model, one list, one reminder engine.

### 2.1 `Equipment` (registry / maintainable item)

| Field             | Type                          | Notes                                                              |
| ----------------- | ----------------------------- | ----------------------------------------------------------------- |
| `id`              | String (cuid)                 | PK                                                                 |
| `numId`           | Int (autoincrement)           | Human-friendly id, per existing model convention                  |
| `branchId`        | String → `Branch`             | The outlet this item belongs to                                   |
| `name`            | String                        | e.g. "Fire Extinguisher – Main Door", "Monthly Pest Control"      |
| `category`        | enum `EquipmentCategory`      | WHAT the item is (see enum below) — used for filtering/reporting  |
| `location`        | String?                       | Kitchen area within the outlet                                    |
| `frequencyMonths` | Int?                          | Default service cycle; `null` = one-off / no auto-schedule        |
| `reminderLeadDays`| Int (default 30)              | Per-item reminder lead time                                       |
| `nextDueDate`     | DateTime?                     | Drives reminders; recalculated when a record is logged            |
| `lastServiceDate` | DateTime?                     | Last completed service                                            |
| `status`          | enum `EquipmentStatus`        | `ACTIVE` / `RETIRED`                                              |
| `notes`           | String?                       | Free text                                                         |
| `createdById`     | String → `User`               | Who registered the item                                          |
| `createdAt`       | DateTime                      |                                                                   |
| `updatedAt`       | DateTime                      |                                                                   |

**Indexes:** `branchId`, `category`, `status`, `nextDueDate`.

`enum EquipmentCategory { FIRE_SAFETY, REFRIGERATION, KITCHEN_EQUIPMENT, ELECTRICAL, PLUMBING, PEST_CONTROL, CLEANING, OTHER }`

`enum EquipmentStatus { ACTIVE, RETIRED }`

### 2.2 `MaintenanceRecord` (service event = digitized sheet row)

| Field             | Type                          | Notes                                                              |
| ----------------- | ----------------------------- | ----------------------------------------------------------------- |
| `id`              | String (cuid)                 | PK                                                                 |
| `numId`           | Int (autoincrement)           |                                                                   |
| `equipmentId`     | String → `Equipment`          | Parent item                                                       |
| `branchId`        | String → `Branch`             | Denormalized from equipment for fast outlet filtering/reporting   |
| `serviceDate`     | DateTime                      | When the service happened                                         |
| `maintenanceType` | enum `MaintenanceType`        | WHAT work was done this time (sheet "Maintenance Type")           |
| `issue`           | String?                       | Issue / Observation                                              |
| `vendorName`      | String?                       | Technician / Vendor                                              |
| `vendorContact`   | String?                       | Phone / contact                                                  |
| `cost`            | Decimal (default 0)           | Amount paid (₹)                                                   |
| `status`          | enum `RecordStatus`           | `PENDING` / `DONE`                                               |
| `remarks`         | String?                       | Remarks                                                          |
| `billUrl`         | String?                       | Azure Blob URL of uploaded bill/invoice (see §6)                 |
| `photoUrls`       | String[]                      | Azure Blob URLs of service photos (see §6)                       |
| `nextDueDate`     | DateTime?                     | Auto-filled from `frequencyMonths`, editable                     |
| `loggedById`      | String → `User`               | Captured from logged-in user (Checked By / Manager)              |
| `createdAt`       | DateTime                      |                                                                   |
| `updatedAt`       | DateTime                      |                                                                   |

**Indexes:** `equipmentId`, `branchId`, `serviceDate`, `maintenanceType`.

`enum MaintenanceType { REPAIR, SERVICE, AMC, INSPECTION, REPLACEMENT, OTHER }`

`enum RecordStatus { PENDING, DONE }`

**On create of a `MaintenanceRecord` with `status = DONE`:**
- Set parent `Equipment.lastServiceDate = serviceDate`.
- Set parent `Equipment.nextDueDate = record.nextDueDate` (which defaults to
  `serviceDate + frequencyMonths` when frequency is set, but is editable).
- This recalculation is what keeps the reminder dashboard accurate.

> **Vendors (v1):** stored as inline `vendorName` / `vendorContact` fields — no
> separate `Vendor` table. Can be normalized into a vendor directory later if needed.

## 3. Reminders — dashboard only (no cron)

Reminders are a **live query**, not a scheduled job. No Azure Function / cron is added
for this module.

- **Due Soon:** `nextDueDate != null AND nextDueDate <= today + reminderLeadDays`
- **Overdue:** `nextDueDate != null AND nextDueDate < today`

Surfaced as:
- **Branch Manager dashboard:** action-item cards for *their outlet's* due/overdue
  items, with a "Log maintenance" shortcut.
- **Management view:** all outlets, grouped by branch, overdue highlighted.

> Future option (out of scope for v1): an email digest reusing the existing
> `sendEmail()` + cron infra, like the document-expiry reminders, if dashboard-only
> proves too easy to miss.

## 4. Access control

New `Feature` strings in `src/lib/access-control.ts`:

| Feature                    | EMPLOYEE | BRANCH_MANAGER        | HR        | MANAGEMENT |
| -------------------------- | -------- | --------------------- | --------- | ---------- |
| `equipment.view`           | ✗        | ✓ (own outlet)        | ✓ (all)   | ✓ (all)    |
| `equipment.manage`         | ✗        | ✓ (own outlet)        | ✗         | ✓ (all)    |
| `equipment.records.create` | ✗        | ✓ (own outlet)        | ✗         | ✓ (all)    |

- **Branch Manager:** full manage + log, scoped to their own outlet only — same
  branch-filter pattern already used in the leave-requests module (HR/MANAGEMENT see
  all; BRANCH_MANAGER sees only their branch; enforced in page queries + API routes).
- **HR:** read-only across all outlets (view equipment, records, costs; no add/edit).
- **Management:** full access, all outlets.
- **No approval workflow:** a logged record is immediately recorded, like the paper
  sheet. `RecordStatus` (PENDING/DONE) describes the work itself, not an approval gate.

## 5. Cost tracking

A **cost summary** view (tab on the registry page): total maintenance spend filterable
by outlet, category, and date range (e.g. "Q2 pest control across all outlets").
Branch managers see their own outlet's costs; HR/Management see all.

## 6. File uploads (bills + photos) — Azure Blob

Reuses the existing `AzureStorageService` (`src/lib/azure-storage.ts`) and the
`uploadJoiningFormFiles` pattern (`src/lib/upload-utils.ts`):

- The **image/file itself is uploaded** to Azure Blob Storage; the service returns a
  URL; **only that URL string is stored in the DB**. No client ever submits a raw URL.
- Folder convention: `equipment/{branchId}/bills/` and `equipment/{branchId}/photos/`.
- `MaintenanceRecord.billUrl` holds one bill URL; `photoUrls[]` holds the photo URLs.

## 7. Routes & components (mirrors existing modules)

Follows the established `(auth)/<module>` + `components/<module>` + `api/<module>`
layout used by leave and attendance.

**Pages** (`src/app/(auth)/equipment/`):
- `page.tsx` — registry list with filters (branch / category / status), due-soon &
  overdue badges, and a cost-summary tab.
- `new/page.tsx` — register a new equipment/service item.
- `[id]/page.tsx` — item detail + maintenance history + "Log maintenance" button.
- `[id]/records/new/page.tsx` — log a service event (digitized sheet row; bill +
  photo upload).

**Components** (`src/components/equipment/`):
- `equipment-table.tsx`, `equipment-form.tsx`
- `maintenance-record-table.tsx`, `maintenance-record-form.tsx`
- `equipment-due-widget.tsx` (dashboard action-items)
- `equipment-cost-summary.tsx`

**API** (`src/app/api/equipment/`):
- `route.ts` (GET list / POST create equipment)
- `[id]/route.ts` (GET / PATCH / DELETE equipment)
- `[id]/records/route.ts` (GET list / POST create record + upload bill/photos)
- All role-gated and branch-scoped per §4.

**Other wiring:**
- Side-nav entry (`src/components/layout/side-nav.tsx`) gated by `equipment.view`.
- New `ActivityType.EQUIPMENT_MAINTENANCE_LOGGED` for the audit ledger
  (`logEntityActivity`).
- Zod schemas + React Hook Form for the forms, matching existing module conventions.

## 8. Out of scope (v1 / YAGNI)

- Email/SMS reminders (dashboard-only for v1).
- Separate normalized Vendor directory.
- Approval workflow / cost-threshold sign-off.
- Per-equipment QR codes / asset tagging.
- Cron / scheduled jobs.

## 9. Success criteria

- A manager can register their outlet's equipment and recurring services, and see a
  live list of what's due soon / overdue for their outlet on their dashboard.
- A manager can log a maintenance event with type, vendor, cost, bill, and photos;
  saving it updates the item's next-due date.
- Management can see all outlets' equipment, full service history, and a cost summary
  filterable by outlet / category / date range.
- HR can view everything read-only.
- Bills and photos are stored in Azure Blob with only their URLs persisted in Postgres.
