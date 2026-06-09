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
