// src/lib/services/__tests__/equipment-image-validations.test.ts
import { describe, it, expect } from "vitest";
import { equipmentCreateSchema, equipmentUpdateSchema } from "@/lib/validations/equipment";

const img = { base64: "data:image/png;base64,QQ==", contentType: "image/png" };

describe("equipment image validation", () => {
  it("accepts an optional image on create", () => {
    expect(equipmentCreateSchema.safeParse({ name: "X", category: "OTHER", branchId: "b", image: img }).success).toBe(true);
    expect(equipmentCreateSchema.safeParse({ name: "X", category: "OTHER", branchId: "b" }).success).toBe(true);
  });
  it("accepts image + removeImage on update", () => {
    expect(equipmentUpdateSchema.safeParse({ image: img }).success).toBe(true);
    expect(equipmentUpdateSchema.safeParse({ removeImage: true }).success).toBe(true);
  });
  it("rejects a malformed image object", () => {
    expect(equipmentCreateSchema.safeParse({ name: "X", category: "OTHER", branchId: "b", image: { base64: "" } }).success).toBe(false);
  });
  it("rejects an image larger than the 10MB cap, accepts one under it", () => {
    // ~10.5MB decoded (14M base64 chars * 3/4) → over the cap.
    const tooBig = { base64: "A".repeat(14 * 1024 * 1024), contentType: "image/png" };
    expect(equipmentCreateSchema.safeParse({ name: "X", category: "OTHER", branchId: "b", image: tooBig }).success).toBe(false);
    // ~1.5MB decoded → under the cap.
    const ok = { base64: "A".repeat(2 * 1024 * 1024), contentType: "image/png" };
    expect(equipmentCreateSchema.safeParse({ name: "X", category: "OTHER", branchId: "b", image: ok }).success).toBe(true);
  });
});
