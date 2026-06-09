// src/lib/services/equipment-bulk.ts
import ExcelJS from "exceljs";
import type { PrismaClient } from "@prisma/client";
import { EQUIPMENT_CATEGORIES } from "@/lib/validations/equipment";
import { categoryLabel, ALL_CATEGORIES, formatDateIST } from "@/lib/equipment-display";
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

// ── XLSX Build + Parse ────────────────────────────────────────────────────────

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
  try {
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
  } catch (e) {
    if (e instanceof Error && e.message === "ROW_CAP")
      return { ok: false, fileError: "Too many rows (max 2000)." };
    throw e;
  }

  return { ok: true, rows };
}
