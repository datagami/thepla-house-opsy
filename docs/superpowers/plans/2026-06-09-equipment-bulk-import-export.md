# Equipment Bulk Import / Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add XLSX bulk export + import for the equipment item registry — export → edit in Excel → re-import (upsert by hidden Item ID), with row-level error reporting, gated on `equipment.manage` and outlet-scoped.

**Architecture:** A testable service `equipment-bulk.ts` owns the XLSX build/parse, per-row validation, next-due derivation, diff, and DB upsert orchestration. Two thin route handlers (`GET bulk-export`, `POST bulk-import`) wrap it with auth + scope. A client toolbar component (mirroring the salary one) does the download/upload + summary. Reuses the existing `exceljs` dep, equipment zod schemas, `equipmentWhereForRole`/`canManageBranch`, `computeNextDueDate`, `formatDateIST`, `categoryLabel`/`ALL_CATEGORIES`, `hasAccess`, `logEntityActivity`.

**Tech Stack:** Next.js 15 App Router, Prisma + Postgres, ExcelJS, Vitest (node env), shadcn/ui + sonner. Spec: `docs/superpowers/specs/2026-06-09-equipment-bulk-import-export-design.md`.

**Conventions:** prisma import `@/lib/prisma`; tests under `src/**/__tests__/**/*.test.ts`; route handler patterns from `src/app/api/salary/bulk-export|bulk-import/route.ts` (`runtime='nodejs'`, `maxDuration=300`, `dynamic='force-dynamic'`); ExcelJS helpers from `src/lib/services/salary-bulk.ts`.

---

## File Structure

**Created:**
- `src/lib/services/equipment-bulk.ts` — columns, cell readers, `normalizeCategory`/`normalizeStatus`, `validateRow`, `deriveNextDue`, `diffEquipment`, `buildEquipmentWorkbook`, `parseEquipmentWorkbook`, `applyBulkImport`.
- `src/lib/services/__tests__/equipment-bulk-validate.test.ts` — unit tests for the pure helpers.
- `src/lib/services/__tests__/equipment-bulk-workbook.test.ts` — build↔parse round-trip.
- `src/app/api/equipment/bulk-export/route.ts` — GET → xlsx.
- `src/app/api/equipment/bulk-import/route.ts` — POST FormData → summary.
- `src/app/api/equipment/bulk-import/__tests__/route.test.ts` — DB-integration (scope + partial).
- `src/components/equipment/bulk-import-export.tsx` — client toolbar (Export + Import + summary).

**Modified:**
- `src/app/(auth)/equipment/page.tsx` — render `<BulkImportExport>` in the header, gated on `equipment.manage`.

---

## Task 1: Service core — columns, cell readers, value normalizers

**Files:**
- Create: `src/lib/services/equipment-bulk.ts`
- Test: `src/lib/services/__tests__/equipment-bulk-validate.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/services/__tests__/equipment-bulk-validate.test.ts
import { describe, it, expect } from "vitest";
import { normalizeCategory, normalizeStatus } from "@/lib/services/equipment-bulk";

describe("normalizeCategory", () => {
  it("accepts a label (case-insensitive)", () => {
    expect(normalizeCategory("Fire Safety")).toBe("FIRE_SAFETY");
    expect(normalizeCategory("pest control")).toBe("PEST_CONTROL");
  });
  it("accepts the raw enum value", () => {
    expect(normalizeCategory("FIRE_SAFETY")).toBe("FIRE_SAFETY");
    expect(normalizeCategory("other")).toBe("OTHER");
  });
  it("returns null for unknown", () => {
    expect(normalizeCategory("Freezr")).toBeNull();
    expect(normalizeCategory("")).toBeNull();
    expect(normalizeCategory(null)).toBeNull();
  });
});

describe("normalizeStatus", () => {
  it("parses ACTIVE/RETIRED case-insensitively, defaults ACTIVE on blank", () => {
    expect(normalizeStatus("active")).toBe("ACTIVE");
    expect(normalizeStatus("RETIRED")).toBe("RETIRED");
    expect(normalizeStatus(null)).toBe("ACTIVE");
    expect(normalizeStatus("")).toBe("ACTIVE");
  });
  it("returns null for unknown", () => {
    expect(normalizeStatus("archived")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/__tests__/equipment-bulk-validate.test.ts`
Expected: FAIL — cannot find module `@/lib/services/equipment-bulk`.

- [ ] **Step 3: Write the implementation (this file grows over Tasks 1–5)**

```typescript
// src/lib/services/equipment-bulk.ts
import ExcelJS from "exceljs";
import type { PrismaClient } from "@prisma/client";
import { EQUIPMENT_CATEGORIES } from "@/lib/validations/equipment";
import { categoryLabel } from "@/lib/equipment-display";
import { computeNextDueDate } from "@/lib/services/maintenance-schedule";

export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

export const SHEET_ITEMS = "Items";
export const SHEET_LISTS = "Lists";

// Column order (1-based) for the Items sheet.
export const HEADERS = [
  "Item ID",
  "Name",
  "Category",
  "Outlet",
  "Location",
  "Service every (months)",
  "Reminder lead (days)",
  "Status",
  "Next due date",
  "Notes",
  "Last serviced",
] as const;

export const COL = {
  id: 1,
  name: 2,
  category: 3,
  outlet: 4,
  location: 5,
  frequencyMonths: 6,
  reminderLeadDays: 7,
  status: 8,
  nextDueDate: 9,
  notes: 10,
  lastServiced: 11,
} as const;

// ── Cell readers (mirrors salary-bulk.ts) ─────────────────────────────────────
export function readCellString(cell: ExcelJS.Cell | undefined): string | null {
  if (!cell) return null;
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && "text" in (v as object)) {
    const t = (v as { text?: string }).text;
    return t?.trim() || null;
  }
  return String(v).trim() || null;
}

export function readCellNumber(cell: ExcelJS.Cell | undefined): number | null {
  if (!cell) return null;
  const v = cell.value;
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : NaN;
  }
  if (typeof v === "object" && "result" in (v as object)) {
    const r = (v as { result?: unknown }).result;
    if (typeof r === "number") return r;
  }
  return NaN;
}

// ── Value normalizers ─────────────────────────────────────────────────────────
const LABEL_TO_ENUM = new Map<string, EquipmentCategory>();
for (const c of EQUIPMENT_CATEGORIES) {
  LABEL_TO_ENUM.set(c.toLowerCase(), c); // enum form
  LABEL_TO_ENUM.set(categoryLabel(c).toLowerCase(), c); // label form
}

export function normalizeCategory(raw: string | null): EquipmentCategory | null {
  if (!raw) return null;
  return LABEL_TO_ENUM.get(raw.trim().toLowerCase()) ?? null;
}

export function normalizeStatus(raw: string | null): "ACTIVE" | "RETIRED" | null {
  if (raw === null || raw.trim() === "") return "ACTIVE";
  const s = raw.trim().toUpperCase();
  if (s === "ACTIVE" || s === "RETIRED") return s;
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/services/__tests__/equipment-bulk-validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/equipment-bulk.ts src/lib/services/__tests__/equipment-bulk-validate.test.ts
git commit -m "feat(equipment-bulk): columns, cell readers, category/status normalizers"
```

---

## Task 2: `validateRow` — per-row field validation + new-row branch resolution

**Files:**
- Modify: `src/lib/services/equipment-bulk.ts`
- Test: `src/lib/services/__tests__/equipment-bulk-validate.test.ts`

- [ ] **Step 1: Add failing tests** (append to the same test file)

```typescript
import { validateRow, type RawRow, type ValidateCtx } from "@/lib/services/equipment-bulk";

function raw(over: Partial<RawRow> = {}): RawRow {
  return {
    rowNumber: 2, id: null, name: "Fire Extinguisher", category: "Fire Safety",
    outlet: "Andheri", location: null, frequencyMonths: 12, reminderLeadDays: 15,
    status: null, nextDueDate: null, notes: null, ...over,
  };
}
const mgmtCtx: ValidateCtx = {
  role: "MANAGEMENT", scopedBranchId: null,
  branchByName: new Map([["andheri", "b-A"], ["bandra", "b-B"]]),
};
const mgrCtx: ValidateCtx = {
  role: "BRANCH_MANAGER", scopedBranchId: "b-A",
  branchByName: new Map([["andheri", "b-A"], ["bandra", "b-B"]]),
};

describe("validateRow", () => {
  it("accepts a valid new row (management) and resolves the outlet", () => {
    const r = validateRow(raw(), mgmtCtx);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.branchId).toBe("b-A"); expect(r.value.category).toBe("FIRE_SAFETY"); expect(r.value.reminderLeadDays).toBe(15); }
  });
  it("rejects empty name and unknown category", () => {
    expect(validateRow(raw({ name: "" }), mgmtCtx).ok).toBe(false);
    expect(validateRow(raw({ category: "Nope" }), mgmtCtx).ok).toBe(false);
  });
  it("rejects a new row whose outlet does not resolve (management)", () => {
    const r = validateRow(raw({ outlet: "Ghost" }), mgmtCtx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/outlet/i);
  });
  it("forces a manager's new row to their own outlet (ignores the Outlet cell)", () => {
    const r = validateRow(raw({ outlet: "Bandra" }), mgrCtx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.branchId).toBe("b-A");
  });
  it("for an id row, defers branch (branchId null) and ignores outlet", () => {
    const r = validateRow(raw({ id: "eq-1", outlet: "Bandra" }), mgmtCtx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.branchId).toBeNull();
  });
  it("rejects bad numbers and out-of-range lead", () => {
    expect(validateRow(raw({ frequencyMonths: NaN }), mgmtCtx).ok).toBe(false);
    expect(validateRow(raw({ reminderLeadDays: 999 }), mgmtCtx).ok).toBe(false);
  });
  it("rejects an unparseable next due date but accepts blank", () => {
    expect(validateRow(raw({ nextDueDate: "not-a-date" }), mgmtCtx).ok).toBe(false);
    expect(validateRow(raw({ nextDueDate: null }), mgmtCtx).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/services/__tests__/equipment-bulk-validate.test.ts`
Expected: FAIL — `validateRow`/`RawRow`/`ValidateCtx` not exported.

- [ ] **Step 3: Add the types + `validateRow` to `equipment-bulk.ts`**

```typescript
// ── Types ─────────────────────────────────────────────────────────────────────
export interface RawRow {
  rowNumber: number;
  id: string | null;
  name: string | null;
  category: string | null;
  outlet: string | null;
  location: string | null;
  frequencyMonths: number | null; // NaN if a non-numeric value was present
  reminderLeadDays: number | null;
  status: string | null;
  nextDueDate: string | null;
  notes: string | null;
}

export interface NormalizedRow {
  rowNumber: number;
  id: string | null;
  name: string;
  category: EquipmentCategory;
  branchId: string | null; // resolved for new rows; null for id rows (resolved in apply)
  location: string | null;
  frequencyMonths: number | null;
  reminderLeadDays: number;
  status: "ACTIVE" | "RETIRED";
  nextDueDate: Date | null; // explicit override; null when the cell was blank
  nextDueProvided: boolean;
  notes: string | null;
}

export interface ValidateCtx {
  role: string;
  scopedBranchId: string | null; // BRANCH_MANAGER's branchId; null for MANAGEMENT
  branchByName: Map<string, string>; // lowercased branch name -> branchId
}

export type ValidateResult =
  | { ok: true; value: NormalizedRow }
  | { ok: false; errors: string[] };

const DEFAULT_LEAD_DAYS = 15;

export function validateRow(r: RawRow, ctx: ValidateCtx): ValidateResult {
  const errors: string[] = [];

  const name = (r.name ?? "").trim();
  if (!name) errors.push("Name is required");

  const category = normalizeCategory(r.category);
  if (!category) errors.push(`Unknown category "${r.category ?? ""}"`);

  const status = normalizeStatus(r.status);
  if (!status) errors.push(`Unknown status "${r.status ?? ""}" (use ACTIVE or RETIRED)`);

  // frequency: blank -> null; NaN -> error; must be a positive integer
  let frequencyMonths: number | null = null;
  if (r.frequencyMonths !== null) {
    if (Number.isNaN(r.frequencyMonths) || !Number.isInteger(r.frequencyMonths) || r.frequencyMonths <= 0) {
      errors.push("Service every (months) must be a positive whole number");
    } else {
      frequencyMonths = r.frequencyMonths;
    }
  }

  // reminder lead: blank -> default; else integer 0..365
  let reminderLeadDays = DEFAULT_LEAD_DAYS;
  if (r.reminderLeadDays !== null) {
    if (Number.isNaN(r.reminderLeadDays) || !Number.isInteger(r.reminderLeadDays) || r.reminderLeadDays < 0 || r.reminderLeadDays > 365) {
      errors.push("Reminder lead (days) must be a whole number 0–365");
    } else {
      reminderLeadDays = r.reminderLeadDays;
    }
  }

  // next due: blank -> not provided; else must parse
  let nextDueDate: Date | null = null;
  let nextDueProvided = false;
  if (r.nextDueDate !== null && r.nextDueDate.trim() !== "") {
    const d = new Date(r.nextDueDate);
    if (Number.isNaN(d.getTime())) errors.push(`Invalid next due date "${r.nextDueDate}"`);
    else { nextDueDate = d; nextDueProvided = true; }
  }

  // branch resolution — only for NEW rows (no id). id rows resolve in apply.
  let branchId: string | null = null;
  if (!r.id) {
    if (ctx.role === "BRANCH_MANAGER") {
      branchId = ctx.scopedBranchId; // forced; Outlet cell ignored
      if (!branchId) errors.push("Your account has no outlet assigned");
    } else {
      const resolved = r.outlet ? ctx.branchByName.get(r.outlet.trim().toLowerCase()) : undefined;
      if (!resolved) errors.push(`Unknown outlet "${r.outlet ?? ""}"`);
      else branchId = resolved;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      rowNumber: r.rowNumber, id: r.id, name, category: category!, branchId,
      location: r.location?.trim() || null, frequencyMonths, reminderLeadDays,
      status: status!, nextDueDate, nextDueProvided, notes: r.notes?.trim() || null,
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/services/__tests__/equipment-bulk-validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/equipment-bulk.ts src/lib/services/__tests__/equipment-bulk-validate.test.ts
git commit -m "feat(equipment-bulk): per-row validation + new-row outlet resolution"
```

---

## Task 3: `deriveNextDue` + `diffEquipment`

**Files:**
- Modify: `src/lib/services/equipment-bulk.ts`
- Test: `src/lib/services/__tests__/equipment-bulk-validate.test.ts`

- [ ] **Step 1: Add failing tests**

```typescript
import { deriveNextDue, diffEquipment } from "@/lib/services/equipment-bulk";

describe("deriveNextDue", () => {
  it("uses the explicit date when provided", () => {
    const explicit = new Date("2027-01-01");
    expect(deriveNextDue(explicit, true, new Date("2026-01-01"), 12)).toEqual(explicit);
  });
  it("computes lastService + frequency when blank", () => {
    const d = deriveNextDue(null, false, new Date("2026-06-09T00:00:00Z"), 12);
    expect(d?.toISOString().slice(0, 10)).toBe("2027-06-09");
  });
  it("falls back to today when there is no last service", () => {
    const today = new Date("2026-06-09T00:00:00Z");
    const d = deriveNextDue(null, false, null, 6, today);
    expect(d?.toISOString().slice(0, 10)).toBe("2026-12-09");
  });
  it("is null when blank and no frequency", () => {
    expect(deriveNextDue(null, false, new Date("2026-01-01"), null)).toBeNull();
  });
});

describe("diffEquipment", () => {
  const existing = {
    name: "A", category: "OTHER", location: null, frequencyMonths: 12,
    reminderLeadDays: 15, status: "ACTIVE", notes: null, nextDueDate: new Date("2027-01-01"),
  };
  it("detects no change", () => {
    expect(diffEquipment(existing, { ...existing })).toEqual({});
  });
  it("detects changed fields only", () => {
    const d = diffEquipment(existing, { ...existing, name: "B", reminderLeadDays: 30 });
    expect(Object.keys(d).sort()).toEqual(["name", "reminderLeadDays"]);
  });
  it("treats nextDueDate equal by timestamp", () => {
    expect(diffEquipment(existing, { ...existing, nextDueDate: new Date("2027-01-01") })).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/services/__tests__/equipment-bulk-validate.test.ts`
Expected: FAIL — `deriveNextDue`/`diffEquipment` not exported.

- [ ] **Step 3: Implement**

```typescript
/** Next due = explicit override, else computeNextDueDate(lastService ?? today, freq). */
export function deriveNextDue(
  explicit: Date | null,
  hasExplicit: boolean,
  lastService: Date | null,
  frequencyMonths: number | null,
  today: Date = new Date()
): Date | null {
  if (hasExplicit) return explicit;
  const base = lastService ?? today;
  return computeNextDueDate(base, frequencyMonths);
}

export interface EquipmentDiffShape {
  name: string;
  category: string;
  location: string | null;
  frequencyMonths: number | null;
  reminderLeadDays: number;
  status: string;
  notes: string | null;
  nextDueDate: Date | null;
}

/** Returns only the changed importable fields (for unchanged-detection). */
export function diffEquipment(
  existing: EquipmentDiffShape,
  incoming: EquipmentDiffShape
): Partial<EquipmentDiffShape> {
  const out: Partial<EquipmentDiffShape> = {};
  const keys: (keyof EquipmentDiffShape)[] = [
    "name", "category", "location", "frequencyMonths", "reminderLeadDays", "status", "notes",
  ];
  for (const k of keys) {
    if (existing[k] !== incoming[k]) {
      (out as Record<string, unknown>)[k] = incoming[k];
    }
  }
  const a = existing.nextDueDate ? existing.nextDueDate.getTime() : null;
  const b = incoming.nextDueDate ? incoming.nextDueDate.getTime() : null;
  if (a !== b) out.nextDueDate = incoming.nextDueDate;
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/services/__tests__/equipment-bulk-validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/equipment-bulk.ts src/lib/services/__tests__/equipment-bulk-validate.test.ts
git commit -m "feat(equipment-bulk): next-due derivation + field diff"
```

---

## Task 4: `buildEquipmentWorkbook` + `parseEquipmentWorkbook` (round-trip)

**Files:**
- Modify: `src/lib/services/equipment-bulk.ts`
- Test: `src/lib/services/__tests__/equipment-bulk-workbook.test.ts`

- [ ] **Step 1: Write the failing round-trip test**

```typescript
// src/lib/services/__tests__/equipment-bulk-workbook.test.ts
import { describe, it, expect } from "vitest";
import { buildEquipmentWorkbook, parseEquipmentWorkbook } from "@/lib/services/equipment-bulk";

const items = [
  {
    id: "eq-1", name: "Fire Extinguisher", category: "FIRE_SAFETY", branchName: "Andheri",
    location: "Hot Kitchen", frequencyMonths: 12, reminderLeadDays: 15, status: "ACTIVE",
    nextDueDate: new Date("2027-06-09T00:00:00Z"), lastServiceDate: new Date("2026-06-09T00:00:00Z"), notes: "AMC",
  },
  {
    id: "eq-2", name: "Pest Control", category: "PEST_CONTROL", branchName: "Andheri",
    location: null, frequencyMonths: 1, reminderLeadDays: 7, status: "ACTIVE",
    nextDueDate: null, lastServiceDate: null, notes: null,
  },
];

describe("workbook round-trip", () => {
  it("builds a sheet that parses back to the same key values", async () => {
    const buf = await buildEquipmentWorkbook(items, { branchNames: ["Andheri", "Bandra"] });
    const parsed = await parseEquipmentWorkbook(Buffer.from(buf));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows).toHaveLength(2);
    const r0 = parsed.rows[0];
    expect(r0.id).toBe("eq-1");
    expect(r0.name).toBe("Fire Extinguisher");
    expect(r0.outlet).toBe("Andheri");
    expect(r0.frequencyMonths).toBe(12);
    const r1 = parsed.rows.find((r) => r.id === "eq-2")!;
    expect(r1.name).toBe("Pest Control");
    expect(r1.frequencyMonths).toBe(1);
  });

  it("returns a file error for a workbook with no Items sheet", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Wrong");
    const buf = await wb.xlsx.writeBuffer();
    const parsed = await parseEquipmentWorkbook(Buffer.from(buf as ArrayBuffer));
    expect(parsed.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/services/__tests__/equipment-bulk-workbook.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement build + parse**

```typescript
import { formatDateIST } from "@/lib/equipment-display";
import { ALL_CATEGORIES } from "@/lib/equipment-display";

export interface ExportItem {
  id: string;
  name: string;
  category: string;
  branchName: string;
  location: string | null;
  frequencyMonths: number | null;
  reminderLeadDays: number;
  status: string;
  nextDueDate: Date | null;
  lastServiceDate: Date | null;
  notes: string | null;
}

const EXTRA_BLANK_ROWS = 50; // so dropdowns/validation cover newly added rows

export async function buildEquipmentWorkbook(
  items: ExportItem[],
  opts: { branchNames: string[] }
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(SHEET_ITEMS);

  // Hidden lists sheet backing the Category + Outlet dropdowns (avoids inline-list
  // length limits and comma-in-name issues).
  const lists = wb.addWorksheet(SHEET_LISTS);
  lists.state = "veryHidden";
  const catLabels = ALL_CATEGORIES.map((c) => categoryLabel(c));
  catLabels.forEach((label, i) => { lists.getCell(i + 1, 1).value = label; }); // col A
  opts.branchNames.forEach((n, i) => { lists.getCell(i + 1, 2).value = n; });   // col B

  sheet.columns = [
    { header: HEADERS[0], width: 24 }, // Item ID
    { header: HEADERS[1], width: 28 }, // Name
    { header: HEADERS[2], width: 20 }, // Category
    { header: HEADERS[3], width: 18 }, // Outlet
    { header: HEADERS[4], width: 18 }, // Location
    { header: HEADERS[5], width: 20 }, // Service every (months)
    { header: HEADERS[6], width: 18 }, // Reminder lead (days)
    { header: HEADERS[7], width: 12 }, // Status
    { header: HEADERS[8], width: 16 }, // Next due date
    { header: HEADERS[9], width: 28 }, // Notes
    { header: HEADERS[10], width: 16 }, // Last serviced
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const it of items) {
    sheet.addRow([
      it.id, it.name, categoryLabel(it.category), it.branchName, it.location ?? "",
      it.frequencyMonths ?? "", it.reminderLeadDays, it.status,
      it.nextDueDate ? formatDateIST(it.nextDueDate) : "",
      it.notes ?? "", it.lastServiceDate ? formatDateIST(it.lastServiceDate) : "",
    ]);
  }

  // Lock the Item ID + Last serviced columns; apply dropdowns to all data rows
  // (existing + a buffer of blank rows for additions).
  const lastRow = items.length + EXTRA_BLANK_ROWS;
  const catRef = `${SHEET_LISTS}!$A$1:$A$${catLabels.length}`;
  const outletRef = `${SHEET_LISTS}!$B$1:$B$${Math.max(1, opts.branchNames.length)}`;
  for (let r = 2; r <= lastRow + 1; r++) {
    sheet.getCell(r, COL.id).protection = { locked: true };
    sheet.getCell(r, COL.lastServiced).protection = { locked: true };
    sheet.getCell(r, COL.category).dataValidation = { type: "list", allowBlank: true, formulae: [catRef] };
    sheet.getCell(r, COL.outlet).dataValidation = { type: "list", allowBlank: true, formulae: [outletRef] };
  }
  // Worksheet protection with unlocked cells editable (matches salary export).
  void sheet.protect("", { selectLockedCells: true, selectUnlockedCells: true });

  return wb.xlsx.writeBuffer();
}

export type ParseResult =
  | { ok: true; rows: RawRow[] }
  | { ok: false; fileError: string };

export async function parseEquipmentWorkbook(buffer: Buffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { ok: false, fileError: "Could not read the file. Upload the exported .xlsx." };
  }
  const sheet = wb.getWorksheet(SHEET_ITEMS);
  if (!sheet) return { ok: false, fileError: `Missing "${SHEET_ITEMS}" sheet — use the exported template.` };

  const rows: RawRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const name = readCellString(row.getCell(COL.name));
    const id = readCellString(row.getCell(COL.id));
    // Skip entirely-blank rows (no id and no name).
    if (!id && !name) return;
    rows.push({
      rowNumber,
      id,
      name,
      category: readCellString(row.getCell(COL.category)),
      outlet: readCellString(row.getCell(COL.outlet)),
      location: readCellString(row.getCell(COL.location)),
      frequencyMonths: readCellNumber(row.getCell(COL.frequencyMonths)),
      reminderLeadDays: readCellNumber(row.getCell(COL.reminderLeadDays)),
      status: readCellString(row.getCell(COL.status)),
      nextDueDate: readCellString(row.getCell(COL.nextDueDate)),
      notes: readCellString(row.getCell(COL.notes)),
    });
    if (rows.length > 2000) throw new Error("ROW_CAP");
  });

  return { ok: true, rows };
}
```

> **Note:** the 2000-row cap throws `ROW_CAP` inside `eachRow`; wrap the call so the route returns a clean message. Adjust Step 3 to catch it:
> ```typescript
>   try {
>     sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => { /* ...as above... */ });
>   } catch (e) {
>     if (e instanceof Error && e.message === "ROW_CAP")
>       return { ok: false, fileError: "Too many rows (max 2000)." };
>     throw e;
>   }
> ```
> Implement the `eachRow` body inside this try/catch (move the `if (rows.length > 2000) throw new Error("ROW_CAP")` to the end of the body).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/services/__tests__/equipment-bulk-workbook.test.ts`
Expected: PASS (2 tests). Date round-trip note: export writes `formatDateIST` strings (e.g. "9 Jun 2027"); `new Date("9 Jun 2027")` parses fine — the test only asserts id/name/outlet/number fields, which are exact.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/equipment-bulk.ts src/lib/services/__tests__/equipment-bulk-workbook.test.ts
git commit -m "feat(equipment-bulk): build + parse XLSX with Category/Outlet dropdowns"
```

---

## Task 5: `applyBulkImport` — DB upsert orchestration

**Files:**
- Modify: `src/lib/services/equipment-bulk.ts`
- (Tested via the route integration test in Task 7 — `applyBulkImport` hits the DB, so it's exercised there rather than in a separate unit test.)

- [ ] **Step 1: Implement `applyBulkImport`**

```typescript
import { ActivityType } from "@prisma/client";
import { logEntityActivity } from "@/lib/services/activity-log";

export interface BulkUser { id: string; role: string; branchId: string | null; }

export interface BulkSummary {
  ok: true;
  created: number;
  updated: number;
  unchanged: number;
  skipped: { row: number; name: string; errors: string[] }[];
}

export async function applyBulkImport(args: {
  prisma: PrismaClient;
  user: BulkUser;
  rows: RawRow[];
  req?: Request;
}): Promise<BulkSummary> {
  const { prisma, user, rows } = args;

  // Build the branch-name → id map (all branches; manager rows are forced anyway).
  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
  const branchByName = new Map(branches.map((b) => [b.name.trim().toLowerCase(), b.id]));

  const ctx: ValidateCtx = {
    role: user.role,
    scopedBranchId: user.role === "BRANCH_MANAGER" ? user.branchId : null,
    branchByName,
  };

  let created = 0, updated = 0, unchanged = 0;
  const skipped: { row: number; name: string; errors: string[] }[] = [];
  const today = new Date();

  for (const raw of rows) {
    const v = validateRow(raw, ctx);
    if (!v.ok) { skipped.push({ row: raw.rowNumber, name: raw.name ?? "", errors: v.errors }); continue; }
    const row = v.value;

    if (row.id) {
      // UPDATE path
      const existing = await prisma.equipment.findUnique({ where: { id: row.id } });
      if (!existing) { skipped.push({ row: row.rowNumber, name: row.name, errors: ["Item ID not found"] }); continue; }
      if (user.role === "BRANCH_MANAGER" && existing.branchId !== user.branchId) {
        skipped.push({ row: row.rowNumber, name: row.name, errors: ["Item is not in your outlet"] }); continue;
      }
      const nextDueDate = deriveNextDue(row.nextDueDate, row.nextDueProvided, existing.lastServiceDate, row.frequencyMonths, today);
      const incoming = {
        name: row.name, category: row.category, location: row.location,
        frequencyMonths: row.frequencyMonths, reminderLeadDays: row.reminderLeadDays,
        status: row.status, notes: row.notes, nextDueDate,
      };
      const changes = diffEquipment(
        {
          name: existing.name, category: existing.category, location: existing.location,
          frequencyMonths: existing.frequencyMonths, reminderLeadDays: existing.reminderLeadDays,
          status: existing.status, notes: existing.notes, nextDueDate: existing.nextDueDate,
        },
        incoming
      );
      if (Object.keys(changes).length === 0) { unchanged++; continue; }
      await prisma.equipment.update({ where: { id: row.id }, data: changes as never });
      updated++;
    } else {
      // CREATE path (branchId resolved in validateRow)
      const nextDueDate = deriveNextDue(row.nextDueDate, row.nextDueProvided, null, row.frequencyMonths, today);
      await prisma.equipment.create({
        data: {
          name: row.name, category: row.category, branchId: row.branchId!,
          location: row.location, frequencyMonths: row.frequencyMonths,
          reminderLeadDays: row.reminderLeadDays, status: row.status,
          nextDueDate, notes: row.notes, createdById: user.id,
        },
      });
      created++;
    }
  }

  await logEntityActivity(
    ActivityType.EQUIPMENT_UPDATED, user.id, "Equipment", "bulk",
    `Bulk import: ${created} created, ${updated} updated, ${unchanged} unchanged, ${skipped.length} skipped`,
    { bulk: true, created, updated, unchanged, skipped: skipped.length }, args.req
  );

  return { ok: true, created, updated, unchanged, skipped };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `equipment-bulk.ts` (ignore the pre-existing `salary-create.test.ts` error). Confirm `prisma.equipment.update`'s `data: changes as never` typechecks; if Prisma rejects the `status`/`category` string types, cast each field at the call site instead of the whole object.

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/equipment-bulk.ts
git commit -m "feat(equipment-bulk): applyBulkImport upsert orchestration + activity log"
```

---

## Task 6: Export route `GET /api/equipment/bulk-export`

**Files:**
- Create: `src/app/api/equipment/bulk-export/route.ts`

- [ ] **Step 1: Implement**

```typescript
// src/app/api/equipment/bulk-export/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { equipmentWhereForRole } from "@/lib/maintenance-access";
import { buildEquipmentWorkbook, type ExportItem } from "@/lib/services/equipment-bulk";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type SessionUser = { id?: string; role?: string; branchId?: string | null };

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  const role = user.role ?? "";
  if (!hasAccess(role, "equipment.manage"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const items = await prisma.equipment.findMany({
    where: equipmentWhereForRole(role, user.branchId ?? null),
    include: { branch: { select: { name: true } } },
    orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
  });

  // Outlet dropdown options: a manager only sees their own outlet; management sees all.
  const branchNames =
    role === "BRANCH_MANAGER"
      ? [...new Set(items.map((i) => i.branch.name))]
      : (await prisma.branch.findMany({ select: { name: true }, orderBy: { name: "asc" } })).map((b) => b.name);

  const exportItems: ExportItem[] = items.map((i) => ({
    id: i.id, name: i.name, category: i.category, branchName: i.branch.name,
    location: i.location, frequencyMonths: i.frequencyMonths, reminderLeadDays: i.reminderLeadDays,
    status: i.status, nextDueDate: i.nextDueDate, lastServiceDate: i.lastServiceDate, notes: i.notes,
  }));

  const buffer = await buildEquipmentWorkbook(exportItems, { branchNames });
  const today = new Date().toISOString().slice(0, 10);
  const scope = role === "BRANCH_MANAGER" ? "outlet" : "all";
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="equipment-${scope}-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
```

- [ ] **Step 2: Manual verify**

Start dev (`npm run dev`), then as a manager/management session hit `http://localhost:3000/api/equipment/bulk-export` in the browser → an `.xlsx` downloads with the Items sheet, the Category + Outlet dropdowns, and the Item ID column locked. As an HR session → 403.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/equipment/bulk-export/route.ts
git commit -m "feat(equipment-bulk): export route (scoped XLSX + dropdowns)"
```

---

## Task 7: Import route `POST /api/equipment/bulk-import` (+ DB integration test)

**Files:**
- Create: `src/app/api/equipment/bulk-import/route.ts`
- Test: `src/app/api/equipment/bulk-import/__tests__/route.test.ts`

- [ ] **Step 1: Implement the route**

```typescript
// src/app/api/equipment/bulk-import/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { parseEquipmentWorkbook, applyBulkImport } from "@/lib/services/equipment-bulk";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type SessionUser = { id?: string; role?: string; branchId?: string | null };

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!user.id || !hasAccess(user.role ?? "", "equipment.manage"))
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  let buffer: Buffer;
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Missing file field" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, error: "File too large (max 10MB)" }, { status: 400 });
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const parsed = await parseEquipmentWorkbook(buffer);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.fileError }, { status: 400 });

  const summary = await applyBulkImport({
    prisma,
    user: { id: user.id, role: user.role ?? "", branchId: user.branchId ?? null },
    rows: parsed.rows,
    req,
  });
  return NextResponse.json(summary);
}
```

- [ ] **Step 2: Write the DB-integration test** (mirrors `src/app/api/equipment/__tests__/route.test.ts`)

```typescript
// src/app/api/equipment/bulk-import/__tests__/route.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "@/app/api/equipment/bulk-import/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildEquipmentWorkbook, type ExportItem } from "@/lib/services/equipment-bulk";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
const authMock = auth as unknown as ReturnType<typeof vi.fn>;

const BR_A = "__test_bulk_a";
const BR_B = "__test_bulk_b";

beforeEach(async () => {
  await prisma.branch.upsert({ where: { id: BR_A }, update: {}, create: { id: BR_A, name: "__test_bulk_A", city: "X", state: "Y" } });
  await prisma.branch.upsert({ where: { id: BR_B }, update: {}, create: { id: BR_B, name: "__test_bulk_B", city: "X", state: "Y" } });
  await prisma.user.upsert({
    where: { id: "__test_bulk_mgr" }, update: {},
    create: { id: "__test_bulk_mgr", name: "__test_bulk_mgr", email: "__test_bulk_mgr@x.test", role: "BRANCH_MANAGER", status: "ACTIVE", branchId: BR_A },
  });
});

afterEach(async () => {
  await prisma.equipment.deleteMany({ where: { name: { startsWith: "__test_bulk_" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "__test_bulk_" } } });
  await prisma.branch.deleteMany({ where: { name: { startsWith: "__test_bulk_" } } });
  vi.resetAllMocks();
});

function asManager() { authMock.mockResolvedValue({ user: { id: "__test_bulk_mgr", role: "BRANCH_MANAGER", branchId: BR_A } }); }
function asManagement() { authMock.mockResolvedValue({ user: { id: "__test_bulk_mgr", role: "MANAGEMENT", branchId: null } }); }

async function uploadOf(items: Partial<ExportItem>[], branchNames: string[]) {
  const full: ExportItem[] = items.map((p, i) => ({
    id: "", name: `__test_bulk_item_${i}`, category: "OTHER", branchName: "__test_bulk_A",
    location: null, frequencyMonths: null, reminderLeadDays: 15, status: "ACTIVE",
    nextDueDate: null, lastServiceDate: null, notes: null, ...p,
  }));
  const buf = await buildEquipmentWorkbook(full, { branchNames });
  const file = new File([Buffer.from(buf)], "items.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const fd = new FormData();
  fd.set("file", file);
  return new Request("http://t/api/equipment/bulk-import", { method: "POST", body: fd });
}

describe("POST /api/equipment/bulk-import", () => {
  it("creates new rows for a manager in their own outlet", async () => {
    asManager();
    const res = await POST(await uploadOf([{ id: "", name: "__test_bulk_new", branchName: "__test_bulk_A" }], ["__test_bulk_A"]));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.created).toBe(1);
    const made = await prisma.equipment.findFirst({ where: { name: "__test_bulk_new" } });
    expect(made?.branchId).toBe(BR_A);
  });

  it("skips an Item ID that belongs to another outlet (manager)", async () => {
    asManagement();
    const other = await prisma.equipment.create({ data: { name: "__test_bulk_inB", category: "OTHER", branchId: BR_B, reminderLeadDays: 15, createdById: "__test_bulk_mgr" } });
    asManager();
    const res = await POST(await uploadOf([{ id: other.id, name: "__test_bulk_inB", branchName: "__test_bulk_B" }], ["__test_bulk_A"]));
    const body = await res.json();
    expect(body.updated).toBe(0);
    expect(body.skipped.some((s: { errors: string[] }) => s.errors.join().match(/your outlet/i))).toBe(true);
  });

  it("forbids HR", async () => {
    authMock.mockResolvedValue({ user: { id: "__test_bulk_mgr", role: "HR", branchId: null } });
    const res = await POST(await uploadOf([{ name: "__test_bulk_x" }], ["__test_bulk_A"]));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/app/api/equipment/bulk-import/__tests__/route.test.ts`
Expected: PASS (needs a reachable dev DB, like the existing equipment route test).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/equipment/bulk-import/route.ts src/app/api/equipment/bulk-import/__tests__/route.test.ts
git commit -m "feat(equipment-bulk): import route + scope/partial integration tests"
```

---

## Task 8: UI toolbar component

**Files:**
- Create: `src/components/equipment/bulk-import-export.tsx`

- [ ] **Step 1: Implement** (mirrors `src/components/salary/bulk-import-export.tsx`)

```tsx
// src/components/equipment/bulk-import-export.tsx
"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface BulkSummary {
  ok: boolean;
  created: number;
  updated: number;
  unchanged: number;
  skipped: { row: number; name: string; errors: string[] }[];
}

export function BulkImportExport() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [summary, setSummary] = useState<BulkSummary | null>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/equipment/bulk-export");
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `equipment-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  function handlePickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!f) return;
    setPendingFile(f);
    setShowConfirm(true);
  }

  async function handleConfirmUpload() {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", pendingFile);
      const res = await fetch("/api/equipment/bulk-import", { method: "POST", body: fd });
      const json: BulkSummary & { error?: string } = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json?.error ?? "Import failed");
        return;
      }
      setSummary(json);
      setShowConfirm(false);
      setPendingFile(null);
      toast.success(`Imported: ${json.created} created, ${json.updated} updated`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          <Download size={15} className="mr-1.5" />
          {exporting ? "Exporting…" : "Export"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload size={15} className="mr-1.5" />
          Import
        </Button>
        <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handlePickFile} className="hidden" />
      </div>

      {summary && (
        <Card className="w-full max-w-md">
          <CardContent className="space-y-2 p-3 text-[13px]">
            <div>
              <strong>{summary.created}</strong> created · <strong>{summary.updated}</strong> updated ·{" "}
              <strong>{summary.unchanged}</strong> unchanged · <strong>{summary.skipped.length}</strong> skipped
            </div>
            {summary.skipped.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="text-[13px] font-medium text-red-600 hover:underline">
                  View {summary.skipped.length} skipped row(s)
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12.5px] text-muted-foreground">
                    {summary.skipped.map((s) => (
                      <li key={s.row}>
                        Row {s.row} {s.name ? `(${s.name})` : ""}: {s.errors.join("; ")}
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showConfirm} onOpenChange={(o) => { if (!o) { setShowConfirm(false); setPendingFile(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import equipment from spreadsheet?</DialogTitle>
            <DialogDescription>
              Rows with an Item ID update existing items; rows without one create new items.
              Invalid rows are skipped and reported. This does not delete anything.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={uploading} onClick={() => { setShowConfirm(false); setPendingFile(null); }}>
              Cancel
            </Button>
            <Button disabled={uploading} onClick={handleConfirmUpload}>
              {uploading ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/components/equipment/bulk-import-export.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/equipment/bulk-import-export.tsx
git commit -m "feat(equipment-bulk): import/export toolbar component"
```

---

## Task 9: Wire into the Items page header (gated)

**Files:**
- Modify: `src/app/(auth)/equipment/page.tsx`

- [ ] **Step 1: Add the import + render** — at the top with the other imports:

```tsx
import { BulkImportExport } from "@/components/equipment/bulk-import-export";
```

In the page header where the "Add Item" button is rendered (the block already guarded by `canManage`), place the bulk controls beside it. Find the header action area (the `div` containing the `Add Item` `<Button asChild>`/`<Link>`), and wrap so it becomes:

```tsx
<div className="flex flex-wrap items-center gap-2">
  {canManage && <BulkImportExport />}
  {canManage && (
    /* existing Add Item button unchanged */
  )}
</div>
```

Match the existing variable name for the manage check (`canManage = hasAccess(role, "equipment.manage")`, already computed on this page). Keep the existing "Add Item" button exactly as-is; only add `<BulkImportExport />` before it and ensure the wrapper allows wrapping on mobile.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`. Then in the browser at `/equipment`: as a manager/management you see **Export** + **Import** beside **Add Item**; as HR they're absent. Export downloads a file; importing a tweaked copy shows the summary and the list refreshes.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/equipment/page.tsx"
git commit -m "feat(equipment-bulk): surface Export/Import on the Items page (manage-gated)"
```

---

## Task 10: Final verification

- [ ] **Step 1: Unit + type + lint**

Run: `npx vitest run src/lib && npx tsc --noEmit && npx eslint src/components/equipment "src/app/(auth)/equipment" src/lib/services/equipment-bulk.ts`
Expected: all green (ignore the pre-existing `salary-create.test.ts` tsc error).

- [ ] **Step 2: Full build** (stop the dev server first to avoid `.next` corruption)

Run: `npm run build`
Expected: exit 0; routes `/api/equipment/bulk-export` and `/api/equipment/bulk-import` listed.

- [ ] **Step 3: Manual round-trip smoke test**
  1. As a manager: Export → open the `.xlsx` → confirm Category + Outlet dropdowns and the locked Item ID column.
  2. Edit a frequency, add a new row (blank Item ID, pick Category + Outlet, leave Next due blank), save.
  3. Import → summary shows `updated`/`created`; the new item's next-due = today + its frequency; the list refreshes.
  4. Add a row with a bad category → it's skipped and reported, the others still import.
  5. As HR: no Export/Import controls; the routes return 403.

- [ ] **Step 4: Restart the dev server** so it serves the merged build.

---

## Done criteria

- Managers/management can export their scoped items, edit in Excel, and re-import to upsert; HR cannot.
- Outlet + Category are dropdowns; blank Next-due auto-derives from (last service ?? today) + frequency; explicit dates override.
- Invalid rows are skipped with row-level reasons; valid rows still import; unchanged rows are no-ops.
- Bulk `RETIRED` flips status only (no blob deletion — that stays behind the Archive dialog).
- `npx vitest run src/lib` green; build exit 0.
