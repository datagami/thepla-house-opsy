# Maintenance Module — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data model, domain logic, REST APIs, and daily email-reminder cron for an equipment/services maintenance tracker, digitizing the paper "Maintenance Sheet".

**Architecture:** Two Prisma models — `Equipment` (registry that drives reminders) and `MaintenanceRecord` (service-event log). Pure, unit-tested domain functions compute next-due dates and reminder state. Thin API routes reuse the existing `auth()` + branch-scoping + Azure-upload + activity-log patterns. A daily cron route (mirroring `document-expiry`) emails a digest to `management@theplahouse.com`, re-sent daily until each item is resolved or snoozed.

**Tech Stack:** Next.js 15 App Router, Prisma 6 + PostgreSQL, NextAuth 5, Azure Blob Storage, Nodemailer, Vitest (node env), date-fns. Reference spec: `docs/superpowers/specs/2026-06-08-equipment-maintenance-tracker-design.md`.

**Conventions to follow:**
- Prisma client import: `import { prisma } from "@/lib/prisma"`.
- Tests live in `src/**/__tests__/**/*.test.ts` (vitest `include` glob). Node environment — no React component tests.
- Pure-logic tests mock nothing; service tests mock `@/lib/services/email` and DB-integration route tests upsert `__test_`-prefixed rows and clean up (see `src/app/api/offer-letter-snippets/__tests__/route.test.ts`).
- Run a single test file: `npx vitest run src/path/__tests__/file.test.ts`.

---

## File Structure

**Created:**
- `prisma/schema.prisma` (modified) — `Equipment`, `MaintenanceRecord` models + 4 enums + `ActivityType` additions + reverse relations on `Branch`/`User`.
- `src/lib/services/maintenance-schedule.ts` — pure next-due + reminder-state functions.
- `src/lib/services/maintenance-schedule.__tests__` → `src/lib/services/__tests__/maintenance-schedule.test.ts`.
- `src/lib/services/equipment-maintenance-reminders.ts` — recipients, email builder, query, `processEquipmentMaintenanceReminders()`.
- `src/lib/services/__tests__/equipment-maintenance-reminders.test.ts`.
- `src/lib/maintenance-upload.ts` — base64 → Azure Blob upload for bills/photos.
- `src/lib/services/__tests__/maintenance-upload.test.ts`.
- `src/lib/maintenance-access.ts` — pure `equipmentWhereForRole()` branch-scoping helper.
- `src/lib/services/__tests__/maintenance-access.test.ts`.
- `src/lib/validations/equipment.ts` — Zod schemas shared by API + forms.
- `src/app/api/equipment/route.ts` — GET list / POST create equipment.
- `src/app/api/equipment/[id]/route.ts` — GET / PATCH / DELETE equipment.
- `src/app/api/equipment/[id]/records/route.ts` — GET list / POST create record.
- `src/app/api/equipment/[id]/snooze/route.ts` — POST set/clear snooze.
- `src/app/api/cron/equipment-maintenance/route.ts` — CRON_SECRET-guarded cron.
- `src/app/api/equipment/__tests__/route.test.ts` — DB-integration route tests.
- `opsy-timer/equipment-maintenance-timer/__init__.py` + `function.json` — Azure timer.

**Modified:**
- `src/lib/access-control.ts` — add `equipment.*` features.

---

## Task 1: Prisma schema — models, enums, relations

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the four enums** (place after the existing `enum UniformStatus { ... }` block, before `model Department`)

```prisma
enum EquipmentCategory {
  FIRE_SAFETY
  REFRIGERATION
  KITCHEN_EQUIPMENT
  ELECTRICAL
  PLUMBING
  PEST_CONTROL
  CLEANING
  OTHER
}

enum EquipmentStatus {
  ACTIVE
  RETIRED
}

enum MaintenanceType {
  REPAIR
  SERVICE
  AMC
  INSPECTION
  REPLACEMENT
  OTHER
}

enum MaintenanceRecordStatus {
  PENDING
  DONE
}
```

- [ ] **Step 2: Add the two models** (place them just before the `model ActivityLog` block)

```prisma
model Equipment {
  id               String            @id @default(cuid())
  numId            Int               @default(autoincrement()) @map("num_id")
  name             String
  category         EquipmentCategory @default(OTHER)
  location         String?
  frequencyMonths  Int?              @map("frequency_months")
  reminderLeadDays Int               @default(30) @map("reminder_lead_days")
  nextDueDate      DateTime?         @map("next_due_date")
  lastServiceDate  DateTime?         @map("last_service_date")
  snoozedUntil     DateTime?         @map("snoozed_until")
  status           EquipmentStatus   @default(ACTIVE)
  notes            String?
  branchId         String            @map("branch_id")
  createdById      String            @map("created_by_id")
  createdAt        DateTime          @default(now()) @map("created_at")
  updatedAt        DateTime          @updatedAt @map("updated_at")

  branch    Branch              @relation(fields: [branchId], references: [id], onDelete: Cascade)
  createdBy User                @relation("EquipmentCreatedBy", fields: [createdById], references: [id])
  records   MaintenanceRecord[]

  @@index([branchId])
  @@index([category])
  @@index([status])
  @@index([nextDueDate])
  @@map("equipment")
}

model MaintenanceRecord {
  id              String                  @id @default(cuid())
  numId           Int                     @default(autoincrement()) @map("num_id")
  equipmentId     String                  @map("equipment_id")
  branchId        String                  @map("branch_id")
  serviceDate     DateTime                @map("service_date")
  maintenanceType MaintenanceType         @default(SERVICE) @map("maintenance_type")
  issue           String?
  vendorName      String?                 @map("vendor_name")
  vendorContact   String?                 @map("vendor_contact")
  cost            Decimal                 @default(0) @db.Decimal(10, 2)
  status          MaintenanceRecordStatus @default(DONE)
  remarks         String?
  billUrl         String?                 @map("bill_url")
  photoUrls       String[]                @map("photo_urls")
  nextDueDate     DateTime?               @map("next_due_date")
  loggedById      String                  @map("logged_by_id")
  createdAt       DateTime                @default(now()) @map("created_at")
  updatedAt       DateTime                @updatedAt @map("updated_at")

  equipment Equipment @relation(fields: [equipmentId], references: [id], onDelete: Cascade)
  branch    Branch    @relation(fields: [branchId], references: [id], onDelete: Cascade)
  loggedBy  User      @relation("MaintenanceRecordLoggedBy", fields: [loggedById], references: [id])

  @@index([equipmentId])
  @@index([branchId])
  @@index([serviceDate])
  @@index([maintenanceType])
  @@map("maintenance_records")
}
```

- [ ] **Step 3: Add reverse relations on `Branch`** (inside `model Branch`, in the `// Relations` block alongside `documents BranchDocument[]`)

```prisma
  equipment          Equipment[]
  maintenanceRecords MaintenanceRecord[]
```

- [ ] **Step 4: Add reverse relations on `User`** (inside `model User`, alongside the other back-relations such as `BranchDocumentUploads`)

```prisma
  equipmentCreated         Equipment[]         @relation("EquipmentCreatedBy")
  maintenanceRecordsLogged MaintenanceRecord[] @relation("MaintenanceRecordLoggedBy")
```

- [ ] **Step 5: Extend the `ActivityType` enum** (add these members before `OTHER`)

```prisma
  EQUIPMENT_CREATED
  EQUIPMENT_UPDATED
  EQUIPMENT_DELETED
  EQUIPMENT_MAINTENANCE_LOGGED
  EQUIPMENT_MAINTENANCE_ALERT
  EQUIPMENT_SNOOZED
```

- [ ] **Step 6: Validate the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 7: Create + apply the migration**

Run: `npx prisma migrate dev --name add_equipment_maintenance`
Expected: migration created under `prisma/migrations/`, applied, and `✔ Generated Prisma Client`.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(maintenance): add Equipment + MaintenanceRecord models and enums"
```

---

## Task 2: Pure scheduling logic (`maintenance-schedule.ts`)

**Files:**
- Create: `src/lib/services/maintenance-schedule.ts`
- Test: `src/lib/services/__tests__/maintenance-schedule.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/services/__tests__/maintenance-schedule.test.ts
import { describe, it, expect } from "vitest";
import {
  computeNextDueDate,
  getReminderState,
  daysUntil,
} from "@/lib/services/maintenance-schedule";

describe("computeNextDueDate", () => {
  it("adds frequencyMonths to the service date", () => {
    const due = computeNextDueDate(new Date("2026-01-15T10:00:00Z"), 12);
    expect(due?.toISOString().slice(0, 10)).toBe("2027-01-15");
  });

  it("returns null when frequency is null, zero, or negative", () => {
    expect(computeNextDueDate(new Date("2026-01-15"), null)).toBeNull();
    expect(computeNextDueDate(new Date("2026-01-15"), 0)).toBeNull();
    expect(computeNextDueDate(new Date("2026-01-15"), -3)).toBeNull();
  });
});

describe("getReminderState", () => {
  const today = new Date("2026-06-08T09:00:00Z");
  const base = {
    nextDueDate: new Date("2026-07-01"),
    reminderLeadDays: 30,
    snoozedUntil: null as Date | null,
    status: "ACTIVE" as const,
  };

  it("is NONE for retired items or items with no due date", () => {
    expect(getReminderState({ ...base, status: "RETIRED" }, today)).toBe("NONE");
    expect(getReminderState({ ...base, nextDueDate: null }, today)).toBe("NONE");
  });

  it("is OVERDUE when due date is before today", () => {
    expect(getReminderState({ ...base, nextDueDate: new Date("2026-06-07") }, today)).toBe("OVERDUE");
  });

  it("is DUE_SOON when today is within reminderLeadDays of the due date", () => {
    // due 2026-07-01, lead 30 days => window opens 2026-06-01; today 2026-06-08 is inside
    expect(getReminderState(base, today)).toBe("DUE_SOON");
  });

  it("is OK when the due date is further out than the lead window", () => {
    // lead 7 days => window opens 2026-06-24; today 2026-06-08 is before it
    expect(getReminderState({ ...base, reminderLeadDays: 7 }, today)).toBe("OK");
  });

  it("is SNOOZED when snoozedUntil is in the future, even if overdue", () => {
    expect(
      getReminderState(
        { ...base, nextDueDate: new Date("2026-06-01"), snoozedUntil: new Date("2026-06-20") },
        today
      )
    ).toBe("SNOOZED");
  });

  it("ignores a snooze that has already passed", () => {
    expect(
      getReminderState(
        { ...base, nextDueDate: new Date("2026-06-01"), snoozedUntil: new Date("2026-06-05") },
        today
      )
    ).toBe("OVERDUE");
  });
});

describe("daysUntil", () => {
  it("is positive in the future, negative in the past", () => {
    expect(daysUntil(new Date("2026-06-18"), new Date("2026-06-08"))).toBe(10);
    expect(daysUntil(new Date("2026-06-03"), new Date("2026-06-08"))).toBe(-5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/__tests__/maintenance-schedule.test.ts`
Expected: FAIL — cannot find module `@/lib/services/maintenance-schedule`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/services/maintenance-schedule.ts
import { addDays, addMonths, differenceInCalendarDays, startOfDay } from "date-fns";

export type ReminderState = "OVERDUE" | "DUE_SOON" | "OK" | "SNOOZED" | "NONE";

/** Next due date = serviceDate + frequencyMonths. Null when no positive frequency. */
export function computeNextDueDate(
  serviceDate: Date,
  frequencyMonths: number | null | undefined
): Date | null {
  if (!frequencyMonths || frequencyMonths <= 0) return null;
  return addMonths(startOfDay(serviceDate), frequencyMonths);
}

export interface ReminderInput {
  nextDueDate: Date | null;
  reminderLeadDays: number;
  snoozedUntil: Date | null;
  status: "ACTIVE" | "RETIRED";
}

/** Classify an item's reminder state relative to `today`. */
export function getReminderState(item: ReminderInput, today: Date): ReminderState {
  if (item.status === "RETIRED" || !item.nextDueDate) return "NONE";
  const t = startOfDay(today);
  if (item.snoozedUntil && startOfDay(item.snoozedUntil) > t) return "SNOOZED";
  const due = startOfDay(item.nextDueDate);
  if (due < t) return "OVERDUE";
  const windowOpens = addDays(due, -item.reminderLeadDays);
  if (windowOpens <= t) return "DUE_SOON";
  return "OK";
}

/** Whole calendar days from `from` to `target` (positive = future). */
export function daysUntil(target: Date, from: Date): number {
  return differenceInCalendarDays(startOfDay(target), startOfDay(from));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/services/__tests__/maintenance-schedule.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/maintenance-schedule.ts src/lib/services/__tests__/maintenance-schedule.test.ts
git commit -m "feat(maintenance): pure next-due + reminder-state logic"
```

---

## Task 3: Branch-scoping helper (`maintenance-access.ts`)

**Files:**
- Create: `src/lib/maintenance-access.ts`
- Test: `src/lib/services/__tests__/maintenance-access.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/services/__tests__/maintenance-access.test.ts
import { describe, it, expect } from "vitest";
import { equipmentWhereForRole, canManageBranch } from "@/lib/maintenance-access";

describe("equipmentWhereForRole", () => {
  it("scopes BRANCH_MANAGER to their own branch", () => {
    expect(equipmentWhereForRole("BRANCH_MANAGER", "b-1")).toEqual({ branchId: "b-1" });
  });

  it("gives MANAGEMENT and HR an unscoped (all-branches) filter", () => {
    expect(equipmentWhereForRole("MANAGEMENT", "b-1")).toEqual({});
    expect(equipmentWhereForRole("HR", null)).toEqual({});
  });

  it("forces an impossible filter for a branch manager with no branch", () => {
    expect(equipmentWhereForRole("BRANCH_MANAGER", null)).toEqual({ branchId: "__none__" });
  });
});

describe("canManageBranch", () => {
  it("lets MANAGEMENT manage any branch", () => {
    expect(canManageBranch("MANAGEMENT", null, "b-9")).toBe(true);
  });
  it("lets a BRANCH_MANAGER manage only their own branch", () => {
    expect(canManageBranch("BRANCH_MANAGER", "b-1", "b-1")).toBe(true);
    expect(canManageBranch("BRANCH_MANAGER", "b-1", "b-2")).toBe(false);
  });
  it("denies HR and EMPLOYEE", () => {
    expect(canManageBranch("HR", null, "b-1")).toBe(false);
    expect(canManageBranch("EMPLOYEE", "b-1", "b-1")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/__tests__/maintenance-access.test.ts`
Expected: FAIL — cannot find module `@/lib/maintenance-access`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/maintenance-access.ts
import type { Prisma } from "@prisma/client";

/**
 * Read scope: BRANCH_MANAGER sees only their branch; HR/MANAGEMENT see all.
 * A manager with no branch gets an impossible filter so they see nothing.
 */
export function equipmentWhereForRole(
  role: string,
  branchId: string | null
): Prisma.EquipmentWhereInput {
  if (role === "MANAGEMENT" || role === "HR") return {};
  if (role === "BRANCH_MANAGER") return { branchId: branchId ?? "__none__" };
  return { branchId: "__none__" };
}

/** Write scope: MANAGEMENT anywhere, BRANCH_MANAGER only in their own branch. */
export function canManageBranch(
  role: string,
  userBranchId: string | null,
  targetBranchId: string
): boolean {
  if (role === "MANAGEMENT") return true;
  if (role === "BRANCH_MANAGER") return !!userBranchId && userBranchId === targetBranchId;
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/services/__tests__/maintenance-access.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/maintenance-access.ts src/lib/services/__tests__/maintenance-access.test.ts
git commit -m "feat(maintenance): branch-scoping access helpers"
```

---

## Task 4: Access-control features

**Files:**
- Modify: `src/lib/access-control.ts`
- Test: `src/lib/__tests__/maintenance-access-control.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/maintenance-access-control.test.ts
import { describe, it, expect } from "vitest";
import { hasAccess } from "@/lib/access-control";

describe("equipment features", () => {
  it("lets BRANCH_MANAGER, HR, MANAGEMENT view", () => {
    for (const r of ["BRANCH_MANAGER", "HR", "MANAGEMENT"]) {
      expect(hasAccess(r, "equipment.view")).toBe(true);
    }
    expect(hasAccess("EMPLOYEE", "equipment.view")).toBe(false);
  });

  it("lets only BRANCH_MANAGER + MANAGEMENT manage / log / snooze", () => {
    for (const f of ["equipment.manage", "equipment.records.create", "equipment.snooze"] as const) {
      expect(hasAccess("BRANCH_MANAGER", f)).toBe(true);
      expect(hasAccess("MANAGEMENT", f)).toBe(true);
      expect(hasAccess("HR", f)).toBe(false);
      expect(hasAccess("EMPLOYEE", f)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/maintenance-access-control.test.ts`
Expected: FAIL — TypeScript/runtime error: `"equipment.view"` not assignable to `Feature` / `permissions[feature]` undefined.

- [ ] **Step 3: Add the features**

In `src/lib/access-control.ts`, append to the `Feature` union (before the closing `;` after `"notes.view"`):

```typescript
  | "equipment.view"
  | "equipment.manage"
  | "equipment.records.create"
  | "equipment.snooze"
```

And add to the `permissions` object (before the closing `}`):

```typescript
  // Maintenance (Equipment & Services)
  "equipment.view": ["BRANCH_MANAGER", "HR", "MANAGEMENT"],
  "equipment.manage": ["BRANCH_MANAGER", "MANAGEMENT"],
  "equipment.records.create": ["BRANCH_MANAGER", "MANAGEMENT"],
  "equipment.snooze": ["BRANCH_MANAGER", "MANAGEMENT"],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/maintenance-access-control.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/access-control.ts src/lib/__tests__/maintenance-access-control.test.ts
git commit -m "feat(maintenance): add equipment.* access-control features"
```

---

## Task 5: Upload helper (`maintenance-upload.ts`)

**Files:**
- Create: `src/lib/maintenance-upload.ts`
- Test: `src/lib/services/__tests__/maintenance-upload.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/services/__tests__/maintenance-upload.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadMaintenanceFiles } from "@/lib/maintenance-upload";

const uploadImage = vi.fn();
vi.mock("@/lib/azure-storage", () => ({
  AzureStorageService: class {
    uploadImage = uploadImage;
  },
}));

beforeEach(() => {
  uploadImage.mockReset();
  uploadImage.mockImplementation(async (_buf, fileName: string, folder: string) =>
    `https://blob.test/${folder}/${fileName}`
  );
});

describe("uploadMaintenanceFiles", () => {
  it("returns nulls/empties when nothing is supplied", async () => {
    const res = await uploadMaintenanceFiles({}, "eq-1", "b-1");
    expect(res).toEqual({ billUrl: null, photoUrls: [] });
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("uploads a pdf bill to the bills folder and returns its url", async () => {
    const res = await uploadMaintenanceFiles(
      { bill: { base64: "data:application/pdf;base64,QQ==", contentType: "application/pdf" } },
      "eq-1",
      "b-1"
    );
    expect(res.billUrl).toContain("equipment/b-1/bills/");
    expect(res.billUrl).toMatch(/\.pdf$/);
    expect(uploadImage).toHaveBeenCalledTimes(1);
    // base64 "QQ==" decodes to byte 0x41
    expect(Buffer.isBuffer(uploadImage.mock.calls[0][0])).toBe(true);
  });

  it("uploads each photo to the photos folder", async () => {
    const res = await uploadMaintenanceFiles(
      {
        photos: [
          { base64: "data:image/jpeg;base64,QQ==", contentType: "image/jpeg" },
          { base64: "QQ==", contentType: "image/png" },
        ],
      },
      "eq-1",
      "b-1"
    );
    expect(res.photoUrls).toHaveLength(2);
    expect(res.photoUrls[0]).toContain("equipment/b-1/photos/");
    expect(res.photoUrls[0]).toMatch(/\.jpg$/);
    expect(res.photoUrls[1]).toMatch(/\.png$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/__tests__/maintenance-upload.test.ts`
Expected: FAIL — cannot find module `@/lib/maintenance-upload`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/maintenance-upload.ts
import { AzureStorageService } from "./azure-storage";

export interface UploadFile {
  base64: string;
  contentType: string;
}

export interface MaintenanceUploadInput {
  bill?: UploadFile | null;
  photos?: UploadFile[];
}

export interface MaintenanceUploadResult {
  billUrl: string | null;
  photoUrls: string[];
}

const EXT_BY_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function extFor(contentType: string): string {
  return EXT_BY_TYPE[contentType] ?? "bin";
}

function decodeBase64(data: string): Buffer {
  const stripped = data.replace(/^data:[^;]+;base64,/, "");
  return Buffer.from(stripped, "base64");
}

/**
 * Uploads a bill and/or service photos to Azure Blob and returns their URLs.
 * Only the returned URL strings are persisted in the DB (the files live in Blob).
 * Folders: equipment/{branchId}/bills, equipment/{branchId}/photos.
 */
export async function uploadMaintenanceFiles(
  input: MaintenanceUploadInput,
  equipmentId: string,
  branchId: string
): Promise<MaintenanceUploadResult> {
  const azure = new AzureStorageService();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  let billUrl: string | null = null;
  if (input.bill) {
    const fileName = `bill-${equipmentId}-${stamp}.${extFor(input.bill.contentType)}`;
    billUrl = await azure.uploadImage(
      decodeBase64(input.bill.base64),
      fileName,
      `equipment/${branchId}/bills`,
      input.bill.contentType
    );
  }

  const photoUrls: string[] = [];
  const photos = input.photos ?? [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const fileName = `photo-${equipmentId}-${stamp}-${i}.${extFor(p.contentType)}`;
    const url = await azure.uploadImage(
      decodeBase64(p.base64),
      fileName,
      `equipment/${branchId}/photos`,
      p.contentType
    );
    photoUrls.push(url);
  }

  return { billUrl, photoUrls };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/services/__tests__/maintenance-upload.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/maintenance-upload.ts src/lib/services/__tests__/maintenance-upload.test.ts
git commit -m "feat(maintenance): Azure Blob upload helper for bills + photos"
```

---

## Task 6: Reminder service (`equipment-maintenance-reminders.ts`)

**Files:**
- Create: `src/lib/services/equipment-maintenance-reminders.ts`
- Test: `src/lib/services/__tests__/equipment-maintenance-reminders.test.ts`

- [ ] **Step 1: Write the failing test** (mocks `email`; `prisma` and `logActivity` mocked so the test is pure)

```typescript
// src/lib/services/__tests__/equipment-maintenance-reminders.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getEquipmentMaintenanceRecipients,
  buildMaintenanceReminderEmail,
  partitionDueItems,
  DueItem,
} from "@/lib/services/equipment-maintenance-reminders";

const today = new Date("2026-06-08T09:00:00Z");

function item(over: Partial<DueItem> = {}): DueItem {
  return {
    id: "eq-1",
    name: "Fire Extinguisher",
    category: "FIRE_SAFETY",
    location: "Hot Kitchen",
    branchName: "Andheri",
    nextDueDate: new Date("2026-07-01"),
    reminderLeadDays: 30,
    snoozedUntil: null,
    status: "ACTIVE",
    ...over,
  };
}

describe("getEquipmentMaintenanceRecipients", () => {
  it("defaults to management@theplahouse.com", () => {
    const prev = process.env.EQUIPMENT_MAINTENANCE_EMAILS;
    delete process.env.EQUIPMENT_MAINTENANCE_EMAILS;
    expect(getEquipmentMaintenanceRecipients()).toEqual(["management@theplahouse.com"]);
    if (prev !== undefined) process.env.EQUIPMENT_MAINTENANCE_EMAILS = prev;
  });

  it("honors a comma-separated override (trimmed, empties dropped)", () => {
    const prev = process.env.EQUIPMENT_MAINTENANCE_EMAILS;
    process.env.EQUIPMENT_MAINTENANCE_EMAILS = "a@x.com, b@x.com ,";
    expect(getEquipmentMaintenanceRecipients()).toEqual(["a@x.com", "b@x.com"]);
    if (prev === undefined) delete process.env.EQUIPMENT_MAINTENANCE_EMAILS;
    else process.env.EQUIPMENT_MAINTENANCE_EMAILS = prev;
  });
});

describe("partitionDueItems", () => {
  it("splits into overdue and dueSoon, dropping OK and snoozed", () => {
    const items = [
      item({ id: "overdue", nextDueDate: new Date("2026-06-01") }),
      item({ id: "soon", nextDueDate: new Date("2026-07-01"), reminderLeadDays: 30 }),
      item({ id: "ok", nextDueDate: new Date("2026-12-01"), reminderLeadDays: 7 }),
      item({ id: "snoozed", nextDueDate: new Date("2026-06-01"), snoozedUntil: new Date("2026-06-20") }),
    ];
    const { overdue, dueSoon } = partitionDueItems(items, today);
    expect(overdue.map((i) => i.id)).toEqual(["overdue"]);
    expect(dueSoon.map((i) => i.id)).toEqual(["soon"]);
  });
});

describe("buildMaintenanceReminderEmail", () => {
  it("includes counts, item names, outlet and an Overdue section", () => {
    const { subject, html } = buildMaintenanceReminderEmail(
      [item({ id: "o", name: "Chest Freezer", nextDueDate: new Date("2026-06-01") })],
      [item({ id: "s", name: "Pest Control" })],
      today
    );
    expect(subject).toContain("1 Overdue");
    expect(subject).toContain("1 Due Soon");
    expect(html).toContain("Chest Freezer");
    expect(html).toContain("Pest Control");
    expect(html).toContain("Andheri");
    expect(html).toContain("Overdue");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/__tests__/equipment-maintenance-reminders.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/services/equipment-maintenance-reminders.ts
import { prisma } from "@/lib/prisma";
import { sendEmail } from "./email";
import { logActivity } from "./activity-log";
import { getReminderState, daysUntil } from "./maintenance-schedule";
import { ActivityType } from "@prisma/client";
import { format } from "date-fns";

export interface DueItem {
  id: string;
  name: string;
  category: string;
  location: string | null;
  branchName: string;
  nextDueDate: Date | null;
  reminderLeadDays: number;
  snoozedUntil: Date | null;
  status: "ACTIVE" | "RETIRED";
}

const DEFAULT_RECIPIENTS = ["management@theplahouse.com"];

export function getEquipmentMaintenanceRecipients(): string[] {
  const raw = process.env.EQUIPMENT_MAINTENANCE_EMAILS;
  if (!raw) return DEFAULT_RECIPIENTS;
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_RECIPIENTS;
}

export function partitionDueItems(items: DueItem[], today: Date) {
  const overdue: DueItem[] = [];
  const dueSoon: DueItem[] = [];
  for (const it of items) {
    const state = getReminderState(it, today);
    if (state === "OVERDUE") overdue.push(it);
    else if (state === "DUE_SOON") dueSoon.push(it);
  }
  return { overdue, dueSoon };
}

function renderSection(title: string, items: DueItem[], color: string, today: Date): string {
  if (items.length === 0) return "";
  let html = `<h3 style="color:${color};border-bottom:2px solid ${color};padding-bottom:5px;">${title} (${items.length})</h3>`;
  html += `<ul style="list-style:none;padding-left:0;">`;
  for (const it of items) {
    const due = it.nextDueDate ? new Date(it.nextDueDate) : null;
    const when = due
      ? `${format(due, "PPP")} (${daysUntil(due, today)} days)`
      : "—";
    html += `
      <li style="margin-bottom:10px;padding:10px;background:#f9f9f9;border-left:4px solid ${color};">
        <strong>${it.name}</strong> (${it.category})<br/>
        <strong>Outlet:</strong> ${it.branchName}${it.location ? ` — ${it.location}` : ""}<br/>
        <strong>Next due:</strong> ${when}
      </li>`;
  }
  html += `</ul>`;
  return html;
}

export function buildMaintenanceReminderEmail(
  overdue: DueItem[],
  dueSoon: DueItem[],
  today: Date
): { subject: string; html: string } {
  const subject = `Opsy Maintenance: ${overdue.length} Overdue, ${dueSoon.length} Due Soon`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#333;">Equipment Maintenance Report</h2>
      <p>Daily automated report of equipment & services due for maintenance.</p>
      ${renderSection("🚨 Overdue (Action Required!)", overdue, "#dc2626", today)}
      ${renderSection("⏰ Due Soon", dueSoon, "#ca8a04", today)}
      <p style="margin-top:20px;font-size:12px;color:#666;">
        Generated automatically by Opsy. Log in to record maintenance or snooze an item.
      </p>
    </div>`;
  return { subject, html };
}

/** Fetch all active, non-snoozed items with a due date — partitioned in JS by per-item lead. */
export async function getCandidateItems(today: Date): Promise<DueItem[]> {
  const rows = await prisma.equipment.findMany({
    where: {
      status: "ACTIVE",
      nextDueDate: { not: null },
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: today } }],
    },
    select: {
      id: true,
      name: true,
      category: true,
      location: true,
      nextDueDate: true,
      reminderLeadDays: true,
      snoozedUntil: true,
      status: true,
      branch: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    location: r.location,
    branchName: r.branch.name,
    nextDueDate: r.nextDueDate,
    reminderLeadDays: r.reminderLeadDays,
    snoozedUntil: r.snoozedUntil,
    status: r.status as "ACTIVE" | "RETIRED",
  }));
}

export async function processEquipmentMaintenanceReminders() {
  const today = new Date();
  const candidates = await getCandidateItems(today);
  const { overdue, dueSoon } = partitionDueItems(candidates, today);
  const total = overdue.length + dueSoon.length;

  if (total === 0) {
    return { processed: 0, emailsSent: 0, details: { overdue: 0, dueSoon: 0 } };
  }

  const recipients = getEquipmentMaintenanceRecipients();
  let emailsSent = 0;

  if (recipients.length > 0) {
    const { subject, html } = buildMaintenanceReminderEmail(overdue, dueSoon, today);
    try {
      await sendEmail({ to: recipients, subject, html });
      emailsSent = 1;
      await logActivity({
        activityType: ActivityType.EQUIPMENT_MAINTENANCE_ALERT,
        description: `Daily maintenance reminder sent. ${overdue.length} overdue, ${dueSoon.length} due soon.`,
        metadata: { recipients, counts: { overdue: overdue.length, dueSoon: dueSoon.length }, automated: true },
      });
    } catch (error) {
      console.error("Failed to send maintenance reminder email:", error);
    }
  }

  return {
    processed: total,
    emailsSent,
    details: { overdue: overdue.length, dueSoon: dueSoon.length },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/services/__tests__/equipment-maintenance-reminders.test.ts`
Expected: PASS. (Only the pure exports are exercised; `processEquipmentMaintenanceReminders` is covered indirectly via the cron route in manual verification.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/equipment-maintenance-reminders.ts src/lib/services/__tests__/equipment-maintenance-reminders.test.ts
git commit -m "feat(maintenance): daily reminder digest service (per-item lead, snooze-aware)"
```

---

## Task 7: Zod validations (`validations/equipment.ts`)

**Files:**
- Create: `src/lib/validations/equipment.ts`
- Test: `src/lib/services/__tests__/equipment-validations.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/services/__tests__/equipment-validations.test.ts
import { describe, it, expect } from "vitest";
import { equipmentCreateSchema, maintenanceRecordCreateSchema } from "@/lib/validations/equipment";

describe("equipmentCreateSchema", () => {
  it("accepts a minimal valid item", () => {
    const r = equipmentCreateSchema.safeParse({ name: "Extinguisher", category: "FIRE_SAFETY", branchId: "b-1" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.reminderLeadDays).toBe(30); // default
  });

  it("rejects empty name and bad category", () => {
    expect(equipmentCreateSchema.safeParse({ name: "", category: "FIRE_SAFETY", branchId: "b-1" }).success).toBe(false);
    expect(equipmentCreateSchema.safeParse({ name: "X", category: "NOPE", branchId: "b-1" }).success).toBe(false);
  });
});

describe("maintenanceRecordCreateSchema", () => {
  it("accepts a valid record with cost and type", () => {
    const r = maintenanceRecordCreateSchema.safeParse({
      serviceDate: "2026-06-08", maintenanceType: "SERVICE", cost: 1500, status: "DONE",
    });
    expect(r.success).toBe(true);
  });

  it("rejects negative cost", () => {
    expect(
      maintenanceRecordCreateSchema.safeParse({ serviceDate: "2026-06-08", maintenanceType: "SERVICE", cost: -1 }).success
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/__tests__/equipment-validations.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/validations/equipment.ts
import { z } from "zod";

export const EQUIPMENT_CATEGORIES = [
  "FIRE_SAFETY", "REFRIGERATION", "KITCHEN_EQUIPMENT", "ELECTRICAL",
  "PLUMBING", "PEST_CONTROL", "CLEANING", "OTHER",
] as const;

export const MAINTENANCE_TYPES = [
  "REPAIR", "SERVICE", "AMC", "INSPECTION", "REPLACEMENT", "OTHER",
] as const;

const uploadFile = z.object({ base64: z.string().min(1), contentType: z.string().min(1) });

export const equipmentCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  category: z.enum(EQUIPMENT_CATEGORIES),
  branchId: z.string().min(1, "Outlet is required"),
  location: z.string().trim().optional().nullable(),
  frequencyMonths: z.coerce.number().int().positive().nullable().optional(),
  reminderLeadDays: z.coerce.number().int().min(0).max(365).default(30),
  nextDueDate: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const equipmentUpdateSchema = equipmentCreateSchema.partial().extend({
  status: z.enum(["ACTIVE", "RETIRED"]).optional(),
});

export const maintenanceRecordCreateSchema = z.object({
  serviceDate: z.string().min(1),
  maintenanceType: z.enum(MAINTENANCE_TYPES),
  issue: z.string().trim().optional().nullable(),
  vendorName: z.string().trim().optional().nullable(),
  vendorContact: z.string().trim().optional().nullable(),
  cost: z.coerce.number().min(0).default(0),
  status: z.enum(["PENDING", "DONE"]).default("DONE"),
  remarks: z.string().trim().optional().nullable(),
  nextDueDate: z.string().optional().nullable(),
  bill: uploadFile.optional().nullable(),
  photos: z.array(uploadFile).optional().default([]),
});

export const snoozeSchema = z.object({
  snoozedUntil: z.string().nullable(), // ISO date, or null to clear
});

export type EquipmentCreateInput = z.infer<typeof equipmentCreateSchema>;
export type MaintenanceRecordCreateInput = z.infer<typeof maintenanceRecordCreateSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/services/__tests__/equipment-validations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/equipment.ts src/lib/services/__tests__/equipment-validations.test.ts
git commit -m "feat(maintenance): Zod schemas for equipment + records"
```

---

## Task 8: Equipment collection API (`/api/equipment`)

**Files:**
- Create: `src/app/api/equipment/route.ts`
- Test: `src/app/api/equipment/__tests__/route.test.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/app/api/equipment/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hasAccess } from "@/lib/access-control";
import { equipmentWhereForRole, canManageBranch } from "@/lib/maintenance-access";
import { equipmentCreateSchema } from "@/lib/validations/equipment";
import { logEntityActivity } from "@/lib/services/activity-log";
import { computeNextDueDate } from "@/lib/services/maintenance-schedule";
import { ActivityType } from "@prisma/client";

type SessionUser = { id?: string; role?: string; branchId?: string | null };

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!hasAccess(user.role ?? "", "equipment.view"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const branchFilter = searchParams.get("branchId") ?? undefined;

  const where = {
    ...equipmentWhereForRole(user.role ?? "", user.branchId ?? null),
    ...(category ? { category: category as never } : {}),
    ...(status ? { status: status as never } : {}),
    ...(branchFilter && (user.role === "HR" || user.role === "MANAGEMENT") ? { branchId: branchFilter } : {}),
  };

  const equipment = await prisma.equipment.findMany({
    where,
    include: { branch: { select: { id: true, name: true } } },
    orderBy: [{ nextDueDate: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(equipment);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!user.id || !hasAccess(user.role ?? "", "equipment.manage"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = equipmentCreateSchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  if (!canManageBranch(user.role ?? "", user.branchId ?? null, data.branchId))
    return NextResponse.json({ error: "Cannot create equipment for this outlet" }, { status: 403 });

  // next due: explicit value wins, else derive from frequency if a starting point exists
  const nextDueDate = data.nextDueDate
    ? new Date(data.nextDueDate)
    : computeNextDueDate(new Date(), data.frequencyMonths ?? null);

  const created = await prisma.equipment.create({
    data: {
      name: data.name,
      category: data.category,
      branchId: data.branchId,
      location: data.location ?? null,
      frequencyMonths: data.frequencyMonths ?? null,
      reminderLeadDays: data.reminderLeadDays,
      nextDueDate,
      notes: data.notes ?? null,
      createdById: user.id,
    },
  });

  await logEntityActivity(
    ActivityType.EQUIPMENT_CREATED,
    user.id,
    "Equipment",
    created.id,
    `Registered maintenance item "${created.name}" (${created.category})`,
    { equipmentId: created.id, branchId: created.branchId },
    req
  );

  return NextResponse.json(created, { status: 201 });
}
```

- [ ] **Step 2: Write the DB-integration test**

```typescript
// src/app/api/equipment/__tests__/route.test.ts
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { GET, POST } from "@/app/api/equipment/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
const authMock = auth as unknown as ReturnType<typeof vi.fn>;

const BR_A = "__test_eq_branch_a";
const BR_B = "__test_eq_branch_b";

beforeEach(async () => {
  await prisma.branch.upsert({ where: { id: BR_A }, update: {}, create: { id: BR_A, name: "__test_eq_A", city: "X", state: "Y" } });
  await prisma.branch.upsert({ where: { id: BR_B }, update: {}, create: { id: BR_B, name: "__test_eq_B", city: "X", state: "Y" } });
  await prisma.user.upsert({
    where: { id: "__test_eq_mgr" }, update: {},
    create: { id: "__test_eq_mgr", name: "__test_eq_mgr", email: "__test_eq_mgr@x.test", role: "BRANCH_MANAGER", status: "ACTIVE", branchId: BR_A },
  });
});

afterEach(async () => {
  await prisma.equipment.deleteMany({ where: { name: { startsWith: "__test_eq_" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "__test_eq_" } } });
  await prisma.branch.deleteMany({ where: { name: { startsWith: "__test_eq_" } } });
  vi.resetAllMocks();
});

function asManager() {
  authMock.mockResolvedValue({ user: { id: "__test_eq_mgr", role: "BRANCH_MANAGER", branchId: BR_A } });
}
function asManagement() {
  authMock.mockResolvedValue({ user: { id: "__test_eq_mgr", role: "MANAGEMENT", branchId: null } });
}

function postReq(body: unknown) {
  return new Request("http://t/api/equipment", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/equipment", () => {
  it("lets a manager create an item in their own branch", async () => {
    asManager();
    const res = await POST(postReq({ name: "__test_eq_extinguisher", category: "FIRE_SAFETY", branchId: BR_A, frequencyMonths: 12 }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("__test_eq_extinguisher");
    expect(body.nextDueDate).toBeTruthy(); // derived from frequency
  });

  it("forbids a manager creating in another branch", async () => {
    asManager();
    const res = await POST(postReq({ name: "__test_eq_x", category: "OTHER", branchId: BR_B }));
    expect(res.status).toBe(403);
  });

  it("rejects invalid input with 400", async () => {
    asManager();
    const res = await POST(postReq({ name: "", category: "FIRE_SAFETY", branchId: BR_A }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/equipment", () => {
  it("scopes a manager to their own branch", async () => {
    asManagement();
    await POST(postReq({ name: "__test_eq_inA", category: "OTHER", branchId: BR_A }));
    await POST(postReq({ name: "__test_eq_inB", category: "OTHER", branchId: BR_B }));

    asManager();
    const res = await GET(new Request("http://t/api/equipment"));
    const list = await res.json();
    const names = list.map((e: { name: string }) => e.name);
    expect(names).toContain("__test_eq_inA");
    expect(names).not.toContain("__test_eq_inB");
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/app/api/equipment/__tests__/route.test.ts`
Expected: PASS (requires a reachable dev database, same as existing route tests).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/equipment/route.ts src/app/api/equipment/__tests__/route.test.ts
git commit -m "feat(maintenance): equipment list + create API with branch scoping"
```

---

## Task 9: Equipment item API (`/api/equipment/[id]`)

**Files:**
- Create: `src/app/api/equipment/[id]/route.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/app/api/equipment/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hasAccess } from "@/lib/access-control";
import { canManageBranch } from "@/lib/maintenance-access";
import { equipmentUpdateSchema } from "@/lib/validations/equipment";
import { logEntityActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";

type SessionUser = { id?: string; role?: string; branchId?: string | null };

async function loadAndAuthorize(id: string, user: SessionUser, write: boolean) {
  const item = await prisma.equipment.findUnique({ where: { id } });
  if (!item) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (write) {
    if (!canManageBranch(user.role ?? "", user.branchId ?? null, item.branchId))
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  } else if (user.role === "BRANCH_MANAGER" && item.branchId !== (user.branchId ?? null)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { item };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!hasAccess(user.role ?? "", "equipment.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const item = await prisma.equipment.findUnique({
    where: { id },
    include: {
      branch: { select: { id: true, name: true } },
      records: { orderBy: { serviceDate: "desc" }, include: { loggedBy: { select: { id: true, name: true } } } },
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "BRANCH_MANAGER" && item.branchId !== (user.branchId ?? null))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(item);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!user.id || !hasAccess(user.role ?? "", "equipment.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const guard = await loadAndAuthorize(id, user, true);
  if (guard.error) return guard.error;

  const parsed = equipmentUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  const updated = await prisma.equipment.update({
    where: { id },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.category !== undefined ? { category: d.category } : {}),
      ...(d.location !== undefined ? { location: d.location ?? null } : {}),
      ...(d.frequencyMonths !== undefined ? { frequencyMonths: d.frequencyMonths ?? null } : {}),
      ...(d.reminderLeadDays !== undefined ? { reminderLeadDays: d.reminderLeadDays } : {}),
      ...(d.nextDueDate !== undefined ? { nextDueDate: d.nextDueDate ? new Date(d.nextDueDate) : null } : {}),
      ...(d.notes !== undefined ? { notes: d.notes ?? null } : {}),
      ...(d.status !== undefined ? { status: d.status } : {}),
    },
  });

  await logEntityActivity(ActivityType.EQUIPMENT_UPDATED, user.id, "Equipment", id, `Updated maintenance item "${updated.name}"`, { equipmentId: id }, req);
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!user.id || !hasAccess(user.role ?? "", "equipment.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const guard = await loadAndAuthorize(id, user, true);
  if (guard.error) return guard.error;

  await prisma.equipment.delete({ where: { id } });
  await logEntityActivity(ActivityType.EQUIPMENT_DELETED, user.id, "Equipment", id, `Deleted maintenance item "${guard.item!.name}"`, { equipmentId: id }, req);
  return NextResponse.json({ success: true });
}
```

> **Note on `params`:** Next.js 15 route handlers receive `params` as a `Promise` — always `await params`. Confirm against an existing `[id]` route (e.g. `src/app/api/offer-letter-snippets/[id]/route.ts`) and match its exact signature if it differs.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/equipment/[id]/route.ts
git commit -m "feat(maintenance): equipment detail GET/PATCH/DELETE API"
```

---

## Task 10: Maintenance records API (`/api/equipment/[id]/records`)

**Files:**
- Create: `src/app/api/equipment/[id]/records/route.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/app/api/equipment/[id]/records/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hasAccess } from "@/lib/access-control";
import { canManageBranch } from "@/lib/maintenance-access";
import { maintenanceRecordCreateSchema } from "@/lib/validations/equipment";
import { uploadMaintenanceFiles } from "@/lib/maintenance-upload";
import { computeNextDueDate } from "@/lib/services/maintenance-schedule";
import { logEntityActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";

type SessionUser = { id?: string; role?: string; branchId?: string | null };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!hasAccess(user.role ?? "", "equipment.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const item = await prisma.equipment.findUnique({ where: { id }, select: { branchId: true } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "BRANCH_MANAGER" && item.branchId !== (user.branchId ?? null))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const records = await prisma.maintenanceRecord.findMany({
    where: { equipmentId: id },
    orderBy: { serviceDate: "desc" },
    include: { loggedBy: { select: { id: true, name: true } } },
  });
  return NextResponse.json(records);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!user.id || !hasAccess(user.role ?? "", "equipment.records.create"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const item = await prisma.equipment.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageBranch(user.role ?? "", user.branchId ?? null, item.branchId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = maintenanceRecordCreateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  // Upload bill + photos to Azure; only URLs are stored.
  const { billUrl, photoUrls } = await uploadMaintenanceFiles(
    { bill: d.bill ?? null, photos: d.photos },
    id,
    item.branchId
  );

  const serviceDate = new Date(d.serviceDate);
  const nextDueDate = d.nextDueDate
    ? new Date(d.nextDueDate)
    : computeNextDueDate(serviceDate, item.frequencyMonths);

  const record = await prisma.maintenanceRecord.create({
    data: {
      equipmentId: id,
      branchId: item.branchId,
      serviceDate,
      maintenanceType: d.maintenanceType,
      issue: d.issue ?? null,
      vendorName: d.vendorName ?? null,
      vendorContact: d.vendorContact ?? null,
      cost: d.cost,
      status: d.status,
      remarks: d.remarks ?? null,
      billUrl,
      photoUrls,
      nextDueDate,
      loggedById: user.id,
    },
  });

  // A completed service updates the item's schedule and clears any snooze.
  if (d.status === "DONE") {
    await prisma.equipment.update({
      where: { id },
      data: { lastServiceDate: serviceDate, nextDueDate, snoozedUntil: null },
    });
  }

  await logEntityActivity(
    ActivityType.EQUIPMENT_MAINTENANCE_LOGGED,
    user.id,
    "MaintenanceRecord",
    record.id,
    `Logged ${d.maintenanceType} on "${item.name}" — ₹${d.cost}`,
    { equipmentId: id, recordId: record.id, cost: d.cost, maintenanceType: d.maintenanceType },
    req
  );

  return NextResponse.json(record, { status: 201 });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/equipment/[id]/records/route.ts
git commit -m "feat(maintenance): log maintenance records + upload bill/photos + reschedule"
```

---

## Task 11: Snooze API (`/api/equipment/[id]/snooze`)

**Files:**
- Create: `src/app/api/equipment/[id]/snooze/route.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/app/api/equipment/[id]/snooze/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hasAccess } from "@/lib/access-control";
import { canManageBranch } from "@/lib/maintenance-access";
import { snoozeSchema } from "@/lib/validations/equipment";
import { logEntityActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";

type SessionUser = { id?: string; role?: string; branchId?: string | null };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!user.id || !hasAccess(user.role ?? "", "equipment.snooze"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const item = await prisma.equipment.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageBranch(user.role ?? "", user.branchId ?? null, item.branchId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = snoozeSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const snoozedUntil = parsed.data.snoozedUntil ? new Date(parsed.data.snoozedUntil) : null;
  const updated = await prisma.equipment.update({ where: { id }, data: { snoozedUntil } });

  await logEntityActivity(
    ActivityType.EQUIPMENT_SNOOZED,
    user.id,
    "Equipment",
    id,
    snoozedUntil ? `Snoozed "${item.name}" until ${parsed.data.snoozedUntil}` : `Cleared snooze on "${item.name}"`,
    { equipmentId: id, snoozedUntil: parsed.data.snoozedUntil },
    req
  );

  return NextResponse.json(updated);
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → no errors.

```bash
git add src/app/api/equipment/[id]/snooze/route.ts
git commit -m "feat(maintenance): snooze API for muting reminders until a date"
```

---

## Task 12: Cron route + Azure timer

**Files:**
- Create: `src/app/api/cron/equipment-maintenance/route.ts`
- Create: `opsy-timer/equipment-maintenance-timer/__init__.py`
- Create: `opsy-timer/equipment-maintenance-timer/function.json`

- [ ] **Step 1: Write the cron route** (mirrors `src/app/api/cron/document-expiry/route.ts`)

```typescript
// src/app/api/cron/equipment-maintenance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { processEquipmentMaintenanceReminders } from "@/lib/services/equipment-maintenance-reminders";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized", message: "Invalid or missing CRON_SECRET", timestamp }, { status: 401 });
  }

  try {
    console.log("Running Equipment Maintenance Reminder Cron Job...");
    const result = await processEquipmentMaintenanceReminders();
    const duration = Date.now() - startTime;
    return NextResponse.json({ success: true, message: "Processed maintenance reminders", result, duration: `${duration}ms`, timestamp });
  } catch (error) {
    console.error("Equipment Maintenance Cron Job Error:", error);
    const duration = Date.now() - startTime;
    return NextResponse.json(
      { success: false, error: "Failed to process maintenance reminders", message: error instanceof Error ? error.message : "Unknown error", timestamp, duration: `${duration}ms` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
```

- [ ] **Step 2: Write the Azure timer function** (`__init__.py`, mirrors `document-expiry-timer`)

```python
import logging
import os
import traceback

try:
    import requests
except ImportError:
    logging.error("Failed to import requests")
    raise

import azure.functions as func


def main(mytimer: func.TimerRequest) -> None:
    logging.info('Equipment Maintenance Reminder Cron Job - Azure Function Started')

    cron_secret = os.environ.get('CRON_SECRET')
    api_url = os.environ.get(
        'EQUIPMENT_MAINTENANCE_API_URL',
        'https://opsy.theplahouse.com/api/cron/equipment-maintenance',
    )

    if not cron_secret:
        logging.error('CRON_SECRET environment variable is not set!')
        raise ValueError('CRON_SECRET environment variable is not set!')

    headers = {
        'Authorization': f'Bearer {cron_secret}',
        'User-Agent': 'azure-function-equipment-maintenance-timer/1.0',
        'Content-Type': 'application/json',
    }

    try:
        response = requests.get(api_url, headers=headers, timeout=60, verify=True)
        try:
            response_data = response.json()
        except Exception:
            response_data = {'raw_response': response.text}

        if response.status_code == 200:
            logging.info('SUCCESS: Equipment maintenance cron job completed')
            logging.info(f'Response: {response_data}')
        else:
            logging.error(f'API returned error status: {response.status_code}')
            logging.error(f'Response: {response_data}')
            raise requests.exceptions.HTTPError(f'API return status {response.status_code}')
    except Exception as e:
        logging.error(f'Error calling API: {str(e)}')
        logging.error(traceback.format_exc())
        raise
```

- [ ] **Step 3: Write the timer binding** (`function.json` — daily at 02:45 UTC = 08:15 IST, offset from the existing 02:30 document-expiry job)

```json
{
    "scriptFile": "__init__.py",
    "bindings": [
        {
            "name": "mytimer",
            "type": "timerTrigger",
            "direction": "in",
            "schedule": "0 45 2 * * *"
        }
    ]
}
```

- [ ] **Step 4: Manually verify the cron route end-to-end**

```bash
# In one terminal: npm run dev
# In another (CRON_SECRET must match .env; omit the header if CRON_SECRET is unset locally):
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/equipment-maintenance | npx --yes json 2>/dev/null || \
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/equipment-maintenance
```
Expected: JSON `{ "success": true, "result": { "processed": N, "emailsSent": ..., "details": { "overdue": ..., "dueSoon": ... } }, ... }`. With no due items, `processed: 0`, `emailsSent: 0`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/equipment-maintenance/route.ts opsy-timer/equipment-maintenance-timer
git commit -m "feat(maintenance): daily reminder cron route + Azure timer"
```

---

## Task 13: Full backend regression + env docs

**Files:**
- Modify: `.env.example` (if present — add the new env var; skip if no such file)

- [ ] **Step 1: Document the new env var** — if a `.env.example` (or `.env.local.example`) exists, add:

```
# Maintenance reminder digest recipients (comma-separated). Defaults to management@theplahouse.com
EQUIPMENT_MAINTENANCE_EMAILS=management@theplahouse.com
# Optional: override the cron URL used by the Azure timer
EQUIPMENT_MAINTENANCE_API_URL=https://opsy.theplahouse.com/api/cron/equipment-maintenance
```

- [ ] **Step 2: Run the full unit suite**

Run: `npx vitest run`
Expected: all suites PASS (new maintenance suites + pre-existing suites). If a route test fails for lack of DB, note it and run only the non-DB suites: `npx vitest run src/lib`.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors; lint clean (or only pre-existing warnings).

- [ ] **Step 4: Commit any doc changes**

```bash
git add -A
git commit -m "docs(maintenance): document EQUIPMENT_MAINTENANCE_* env vars" || echo "nothing to commit"
```

---

## Done criteria (backend)

- `npx prisma migrate dev` applied; `Equipment` + `MaintenanceRecord` tables exist.
- `npx vitest run src/lib` green (schedule, access, upload, reminders, validations).
- `POST/GET /api/equipment`, `/api/equipment/[id]`, `/api/equipment/[id]/records`, `/api/equipment/[id]/snooze` enforce role + branch scope.
- `GET /api/cron/equipment-maintenance` returns a digest summary and emails `management@theplahouse.com` when items are due/overdue, daily, until resolved or snoozed.

**Next:** `docs/superpowers/plans/2026-06-08-maintenance-module-frontend.md` builds the UI on these APIs.
