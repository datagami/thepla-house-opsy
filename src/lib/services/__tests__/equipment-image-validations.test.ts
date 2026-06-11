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
});
