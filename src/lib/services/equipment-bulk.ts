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
