/**
 * equipment-display.ts
 *
 * Pure design-system display helpers for the Maintenance UI.
 * Colors sourced directly from:
 *   .design-ref/maintenance/data.js  → CATEGORIES, STATUS_META
 *   .design-ref/maintenance/ui.jsx   → TYPE_TINT
 *
 * No JSX / React imports — safe to use in server code, tests, and components.
 */

import type { ReminderState } from "@/lib/services/maintenance-schedule";

// ─── Category metadata ────────────────────────────────────────────────────────

export interface CategoryMeta {
  label: string;
  /** Lucide icon name (kebab-case string; components convert to component) */
  icon: string;
  fg: string;
  bg: string;
  dot: string;
}

/**
 * Keyed by backend enum values.
 * Colors from data.js CATEGORIES map; icon "chefhat" corrected to "chef-hat"
 * per lucide-react canonical name.
 */
export const CATEGORY_META: Record<string, CategoryMeta> = {
  FIRE_SAFETY:       { label: "Fire Safety",       icon: "flame",     fg: "#b91c1c", bg: "#fef2f2", dot: "#dc2626" },
  REFRIGERATION:     { label: "Refrigeration",     icon: "snowflake", fg: "#1d4ed8", bg: "#eff6ff", dot: "#2563eb" },
  KITCHEN_EQUIPMENT: { label: "Kitchen Equipment", icon: "chef-hat",  fg: "#c2410c", bg: "#fff7ed", dot: "#ea580c" },
  ELECTRICAL:        { label: "Electrical",        icon: "zap",       fg: "#a16207", bg: "#fefce8", dot: "#ca8a04" },
  PLUMBING:          { label: "Plumbing",          icon: "droplet",   fg: "#0e7490", bg: "#ecfeff", dot: "#0891b2" },
  PEST_CONTROL:      { label: "Pest Control",      icon: "bug",       fg: "#6d28d9", bg: "#f5f3ff", dot: "#7c3aed" },
  CLEANING:          { label: "Cleaning",          icon: "sparkles",  fg: "#0f766e", bg: "#f0fdfa", dot: "#0d9488" },
  OTHER:             { label: "Other",             icon: "package",   fg: "#334155", bg: "#f8fafc", dot: "#475569" },
};

/** All 8 backend category enum keys in insertion order. */
export const ALL_CATEGORIES: string[] = Object.keys(CATEGORY_META);

/** Returns the human-readable label for a category enum key. */
export function categoryLabel(c: string): string {
  return CATEGORY_META[c]?.label ?? c;
}

// ─── Maintenance-type tints ───────────────────────────────────────────────────

/**
 * Keyed by backend enum values (uppercase).
 * Colors from ui.jsx TYPE_TINT; OTHER uses the fallback gray from TypeBadge.
 */
export const TYPE_TINT: Record<string, { fg: string; bg: string }> = {
  SERVICE:     { fg: "#1d4ed8", bg: "#eff6ff" },
  REPAIR:      { fg: "#c2410c", bg: "#fff7ed" },
  AMC:         { fg: "#6d28d9", bg: "#f5f3ff" },
  INSPECTION:  { fg: "#0f766e", bg: "#f0fdfa" },
  REPLACEMENT: { fg: "#be123c", bg: "#fff1f2" },
  OTHER:       { fg: "#3f3f46", bg: "#f4f4f5" },
};

const TYPE_LABELS: Record<string, string> = {
  REPAIR:      "Repair",
  SERVICE:     "Service",
  AMC:         "AMC",
  INSPECTION:  "Inspection",
  REPLACEMENT: "Replacement",
  OTHER:       "Other",
};

/** Returns the human-readable label for a maintenance-type enum key. */
export function maintenanceTypeLabel(t: string): string {
  return TYPE_LABELS[t] ?? t;
}

// ─── Currency formatting ──────────────────────────────────────────────────────

const _inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formats a numeric amount as Indian rupees, e.g. ₹1,500 */
export function formatINR(amount: number): string {
  return _inrFormatter.format(amount);
}

// ─── Reminder-state badge ─────────────────────────────────────────────────────

export type BadgeTone = "overdue" | "due-soon" | "ok" | "snoozed" | "none";

export interface StateBadge {
  label: string;
  tone: BadgeTone;
  fg: string;
  bg: string;
  border: string;
  /** Lucide icon name */
  icon: string;
}

/**
 * Status colors from data.js STATUS_META.
 * NONE uses neutral grays (no entry in STATUS_META — derived from snoozed palette).
 */
const STATE_BADGE_MAP: Record<ReminderState, StateBadge> = {
  OVERDUE:  { label: "Overdue",     tone: "overdue",  fg: "#b91c1c", bg: "#fef2f2", border: "#fecaca", icon: "alert-triangle" },
  DUE_SOON: { label: "Due soon",    tone: "due-soon", fg: "#b45309", bg: "#fffbeb", border: "#fde68a", icon: "clock"          },
  OK:       { label: "On track",    tone: "ok",       fg: "#15803d", bg: "#f0fdf4", border: "#bbf7d0", icon: "check"          },
  SNOOZED:  { label: "Snoozed",     tone: "snoozed",  fg: "#52525b", bg: "#f4f4f5", border: "#e4e4e7", icon: "moon"           },
  NONE:     { label: "No schedule", tone: "none",     fg: "#71717a", bg: "#fafafa", border: "#e4e4e7", icon: "minus"          },
};

/** Maps a ReminderState to its display badge metadata. */
export function stateBadge(state: ReminderState): StateBadge {
  return STATE_BADGE_MAP[state];
}
