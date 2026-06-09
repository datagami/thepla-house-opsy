// src/lib/services/__tests__/equipment-bulk-validate.test.ts
import { describe, it, expect } from "vitest";
import { normalizeCategory, normalizeStatus, validateRow, type RawRow, type ValidateCtx } from "@/lib/services/equipment-bulk";

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
