import { describe, it, expect } from "vitest";
import {
  categoryLabel, maintenanceTypeLabel, formatINR, stateBadge,
  CATEGORY_META, TYPE_TINT, ALL_CATEGORIES, formatDateIST,
} from "@/lib/equipment-display";

describe("formatDateIST", () => {
  it("renders a UTC-midnight date as the correct IST calendar day", () => {
    // 2026-06-09T00:00Z is 05:30 IST on 9 Jun → still 9 Jun
    expect(formatDateIST(new Date("2026-06-09T00:00:00Z"))).toBe("9 Jun 2026");
  });
  it("rolls to the next IST day for late-UTC instants", () => {
    // 2026-06-09T20:00Z is 01:30 IST on 10 Jun
    expect(formatDateIST(new Date("2026-06-09T20:00:00Z"))).toBe("10 Jun 2026");
  });
  it("returns an em-dash for nullish input", () => {
    expect(formatDateIST(null)).toBe("—");
    expect(formatDateIST(undefined)).toBe("—");
  });
});

describe("labels", () => {
  it("humanizes categories and types", () => {
    expect(categoryLabel("FIRE_SAFETY")).toBe("Fire Safety");
    expect(categoryLabel("PEST_CONTROL")).toBe("Pest Control");
    expect(maintenanceTypeLabel("AMC")).toBe("AMC");
    expect(maintenanceTypeLabel("REPAIR")).toBe("Repair");
  });
});

describe("formatINR", () => {
  it("formats rupees with the ₹ symbol and no decimals", () => {
    expect(formatINR(1500)).toContain("1,500");
    expect(formatINR(1500)).toContain("₹");
    expect(formatINR(1500)).not.toContain(".");
  });
});

describe("stateBadge", () => {
  it("maps reminder states to label + tone + icon", () => {
    expect(stateBadge("OVERDUE").tone).toBe("overdue");
    expect(stateBadge("DUE_SOON").label).toBe("Due soon");
    expect(stateBadge("SNOOZED").label).toBe("Snoozed");
    expect(stateBadge("OK").label).toBe("On track");
    expect(stateBadge("NONE").label).toBe("No schedule");
    // each has fg/bg/border colors and a lucide icon name
    for (const s of ["OVERDUE","DUE_SOON","OK","SNOOZED","NONE"] as const) {
      const b = stateBadge(s);
      expect(typeof b.fg).toBe("string");
      expect(typeof b.bg).toBe("string");
      expect(typeof b.icon).toBe("string");
    }
  });
});

describe("CATEGORY_META", () => {
  it("has all 8 categories with icon name + colors", () => {
    expect(ALL_CATEGORIES).toHaveLength(8);
    for (const c of ALL_CATEGORIES) {
      const m = CATEGORY_META[c];
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.icon.length).toBeGreaterThan(0);
      expect(m.fg).toMatch(/^#/);
      expect(m.bg).toMatch(/^#/);
    }
    expect(CATEGORY_META.FIRE_SAFETY.label).toBe("Fire Safety");
  });
});

describe("TYPE_TINT", () => {
  it("has tints for all 6 maintenance types", () => {
    for (const t of ["REPAIR","SERVICE","AMC","INSPECTION","REPLACEMENT","OTHER"]) {
      expect(TYPE_TINT[t].fg).toMatch(/^#/);
      expect(TYPE_TINT[t].bg).toMatch(/^#/);
    }
  });
});
