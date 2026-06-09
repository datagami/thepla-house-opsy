// src/lib/services/__tests__/equipment-bulk-validate.test.ts
import { describe, it, expect } from "vitest";
import { normalizeCategory, normalizeStatus, validateRow, deriveNextDue, diffEquipment, type RawRow, type ValidateCtx } from "@/lib/services/equipment-bulk";

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
