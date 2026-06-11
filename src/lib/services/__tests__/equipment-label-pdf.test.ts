// src/lib/services/__tests__/equipment-label-pdf.test.ts
import { describe, it, expect } from "vitest";
import { renderEquipmentLabels, type LabelInput } from "@/lib/services/equipment-label-pdf";

function label(over: Partial<LabelInput> = {}): LabelInput {
  return { tag: "CHD-0042", name: "KOT PC", outlet: "Chandivali", category: "Electrical", url: "https://app.test/equipment/eq-1", ...over };
}

describe("renderEquipmentLabels", () => {
  it("renders a non-empty PDF for one label", async () => {
    const buf = await renderEquipmentLabels([label()]);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
  it("handles 2 and an odd count (3) without throwing", async () => {
    expect((await renderEquipmentLabels([label(), label({ tag: "CHD-0002" })])).subarray(0, 5).toString()).toBe("%PDF-");
    expect((await renderEquipmentLabels([label(), label(), label()])).subarray(0, 5).toString()).toBe("%PDF-");
  });
  it("returns a valid (empty) PDF for no labels", async () => {
    const buf = await renderEquipmentLabels([]);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
