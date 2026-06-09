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
