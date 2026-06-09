// src/lib/services/__tests__/equipment-bulk-validate.test.ts
import { describe, it, expect } from "vitest";
import { normalizeCategory, normalizeStatus } from "@/lib/services/equipment-bulk";

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
