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
    // FIX 1: nextDueDate round-trip — must be ISO date-only string, no IST drift
    expect(r0.nextDueDate).toBe("2027-06-09");
    expect(new Date(r0.nextDueDate!).toISOString()).toBe("2027-06-09T00:00:00.000Z");
    const r1 = parsed.rows.find((r) => r.id === "eq-2")!;
    expect(r1.name).toBe("Pest Control");
    expect(r1.frequencyMonths).toBe(1);
  });

  it("exports blank next-due for an item with null nextDueDate (round-trip stable for cleared schedule)", async () => {
    // Item with nextDueDate: null but frequencyMonths set — export must write blank, not a computed date.
    const itemWithNullNextDue = [
      {
        id: "eq-3", name: "AC Filter", category: "HVAC", branchName: "Andheri",
        location: "Lobby", frequencyMonths: 12, reminderLeadDays: 15, status: "ACTIVE" as const,
        nextDueDate: null, lastServiceDate: null, notes: null,
      },
    ];
    const buf = await buildEquipmentWorkbook(itemWithNullNextDue, { branchNames: ["Andheri"] });
    const parsed = await parseEquipmentWorkbook(Buffer.from(buf));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows).toHaveLength(1);
    const r = parsed.rows[0];
    // The next-due cell must be blank — not a computed date — so re-importing doesn't spuriously repopulate it.
    expect(r.nextDueDate === null || r.nextDueDate === "").toBe(true);
  });

  it("round-trips free-text values starting with formula chars without mutating them", async () => {
    // No csvSafe apostrophe: a value like "-1 Basement" must come back EXACTLY, so a
    // re-import of an unchanged export stays a 0-updated no-op (xlsx string cells are
    // never evaluated as formulas).
    const tricky = [
      {
        id: "eq-9", name: "=SUM scale", category: "OTHER", branchName: "Andheri",
        location: "-1 Basement", frequencyMonths: null, reminderLeadDays: 15, status: "ACTIVE" as const,
        nextDueDate: null, lastServiceDate: null, notes: "+check filter",
      },
    ];
    const buf = await buildEquipmentWorkbook(tricky, { branchNames: ["Andheri"] });
    const parsed = await parseEquipmentWorkbook(Buffer.from(buf));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const r = parsed.rows[0];
    expect(r.name).toBe("=SUM scale");
    expect(r.location).toBe("-1 Basement");
    expect(r.notes).toBe("+check filter");
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
