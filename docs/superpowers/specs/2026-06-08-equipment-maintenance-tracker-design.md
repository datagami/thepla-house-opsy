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

## 1a. Terminology (UI vs code)

- The side-nav menu is labeled **"Maintenance"**.
- The `Equipment` model is shown to users as **"Item"** / **"Items"** everywhere in the
  UI (e.g. "Add Item", "Items due soon"). The Prisma model and code identifiers keep
  the name `Equipment` for precision; only user-facing copy says "Item".
- A `MaintenanceRecord` is shown as a **"Maintenance Record"** or "service entry".

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
| `snoozedUntil`    | DateTime?                     | If set & in the future, suppresses the daily reminder email (see §3) |
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

## 3. Reminders — dashboard + daily email (mirrors document-expiry)

Two delivery channels: a **live dashboard query** and a **daily email digest** built on
the exact same cron + email infrastructure as the existing branch document-expiry
reminders.

### 3.1 Due / overdue definition (per-item lead time)

- **Due Soon:** `nextDueDate != null AND nextDueDate <= today + reminderLeadDays`
  (each item uses its own `reminderLeadDays`, so a monthly pest-control item with a
  7-day lead and an annual extinguisher with a 30-day lead behave correctly).
- **Overdue:** `nextDueDate != null AND nextDueDate < today`.
- An item is **silenced** from reminders when either: it is no longer due (a newer
  `MaintenanceRecord` pushed `nextDueDate` out — "resolved"), `status = RETIRED`, or
  `snoozedUntil != null AND snoozedUntil > today` ("snoozed").

### 3.2 Dashboard

- **Branch Manager dashboard:** action-item cards for *their outlet's* due/overdue
  items, with "Log maintenance" and "Snooze" actions.
- **Management view:** all outlets, grouped by branch, overdue highlighted.

### 3.3 Daily email digest

Mirrors `src/lib/services/document-expiry.ts` + `src/app/api/cron/document-expiry/`:

- **New service:** `src/lib/services/equipment-maintenance-reminders.ts` exporting
  `processEquipmentMaintenanceReminders()`.
- **New cron route:** `src/app/api/cron/equipment-maintenance/route.ts` — GET/POST,
  guarded by `Authorization: Bearer ${CRON_SECRET}`, returns
  `{ success, result, duration, timestamp }`.
- **New Azure timer:** an entry under `opsy-timer/` (sibling of the document-expiry
  timer) that hits the cron route daily.
- **Cadence:** runs **daily**. Every active, non-snoozed item that is Due Soon or
  Overdue is included in that day's digest — so an item is emailed **every day** from
  `nextDueDate - reminderLeadDays` onward **until it is resolved or snoozed**. (No
  per-item "already notified" flag; the daily re-send is intentional.)
- **Recipients:** the env var `EQUIPMENT_MAINTENANCE_EMAILS`, defaulting to
  `management@theplahouse.com`. Single central digest across all outlets (not
  per-manager), matching the document-expiry approach.
- **Email body:** one HTML digest grouped into two sections — `🚨 Overdue` and
  `⏰ Due Soon` — each listing item name, category, outlet, location, due date, and
  days overdue/remaining. Reuses the `renderDocList`-style helper and `sendEmail()`.
- **Audit:** logs `ActivityType.EQUIPMENT_MAINTENANCE_ALERT` (overall report + one per
  overdue item), mirroring how document-expiry logs `DOCUMENT_EXPIRY_ALERT`.

### 3.4 Snooze

A manager/management user can snooze an item's reminder (e.g. "vendor booked for next
week, stop nagging me"):

- Sets `Equipment.snoozedUntil` to a chosen date (UI offers quick options like +7 days
  / +14 days / pick a date).
- While `snoozedUntil > today`, the item is excluded from the daily email **and**
  visually marked "Snoozed until <date>" on the dashboard (still visible, just quiet).
- Snooze is cleared automatically once a new `MaintenanceRecord` resolves the item, and
  the action is logged to the activity ledger.

## 4. Access control

New `Feature` strings in `src/lib/access-control.ts`:

| Feature                    | EMPLOYEE | BRANCH_MANAGER        | HR        | MANAGEMENT |
| -------------------------- | -------- | --------------------- | --------- | ---------- |
| `equipment.view`           | ✗        | ✓ (own outlet)        | ✓ (all)   | ✓ (all)    |
| `equipment.manage`         | ✗        | ✓ (own outlet)        | ✗         | ✓ (all)    |
| `equipment.records.create` | ✗        | ✓ (own outlet)        | ✗         | ✓ (all)    |
| `equipment.snooze`         | ✗        | ✓ (own outlet)        | ✗         | ✓ (all)    |

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
- `[id]/snooze/route.ts` (POST set `snoozedUntil`) — gated by `equipment.snooze`
- All role-gated and branch-scoped per §4.

**Reminder cron (mirrors document-expiry):**
- `src/lib/services/equipment-maintenance-reminders.ts` —
  `processEquipmentMaintenanceReminders()` (see §3.3).
- `src/app/api/cron/equipment-maintenance/route.ts` — `CRON_SECRET`-guarded endpoint.
- `opsy-timer/` Azure timer entry calling the cron route daily.

**Other wiring:**
- Side-nav entry labeled **"Maintenance"** (`src/components/layout/side-nav.tsx`),
  gated by `equipment.view`.
- New `ActivityType.EQUIPMENT_MAINTENANCE_LOGGED` (record logged) and
  `ActivityType.EQUIPMENT_MAINTENANCE_ALERT` (daily reminder report) for the audit
  ledger (`logEntityActivity` / `logActivity`).
- New env var `EQUIPMENT_MAINTENANCE_EMAILS` (default `management@theplahouse.com`).
- Zod schemas + React Hook Form for the forms, matching existing module conventions.

## 8. Out of scope (v1 / YAGNI)

- SMS / push reminders (email + dashboard only for v1).
- Per-manager / per-outlet email recipients (single central digest for v1).
- Separate normalized Vendor directory.
- Approval workflow / cost-threshold sign-off.
- Per-equipment QR codes / asset tagging.

## 9. Success criteria

- A manager can register their outlet's equipment and recurring services, and see a
  live list of what's due soon / overdue for their outlet on their dashboard.
- A manager can log a maintenance event with type, vendor, cost, bill, and photos;
  saving it updates the item's next-due date and silences its reminder.
- A daily cron emails `management@theplahouse.com` a digest of all due/overdue items
  (grouped Overdue / Due Soon), re-sent every day until each item is resolved or
  snoozed — mirroring the existing document-expiry reminder job.
- A manager/management user can snooze an item to suppress its reminder until a chosen
  date.
- Management can see all outlets' equipment, full service history, and a cost summary
  filterable by outlet / category / date range.
- HR can view everything read-only.
- Bills and photos are stored in Azure Blob with only their URLs persisted in Postgres.
