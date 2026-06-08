import { describe, it, expect } from "vitest";
import { equipmentCreateSchema, maintenanceRecordCreateSchema } from "@/lib/validations/equipment";

describe("equipmentCreateSchema", () => {
  it("accepts a minimal valid item", () => {
    const r = equipmentCreateSchema.safeParse({ name: "Extinguisher", category: "FIRE_SAFETY", branchId: "b-1" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.reminderLeadDays).toBe(30); // default
  });

  it("rejects empty name and bad category", () => {
    expect(equipmentCreateSchema.safeParse({ name: "", category: "FIRE_SAFETY", branchId: "b-1" }).success).toBe(false);
    expect(equipmentCreateSchema.safeParse({ name: "X", category: "NOPE", branchId: "b-1" }).success).toBe(false);
  });
});

describe("maintenanceRecordCreateSchema", () => {
  it("accepts a valid record with cost and type", () => {
    const r = maintenanceRecordCreateSchema.safeParse({
      serviceDate: "2026-06-08", maintenanceType: "SERVICE", cost: 1500, status: "DONE",
    });
    expect(r.success).toBe(true);
  });

  it("rejects negative cost", () => {
    expect(
      maintenanceRecordCreateSchema.safeParse({ serviceDate: "2026-06-08", maintenanceType: "SERVICE", cost: -1 }).success
    ).toBe(false);
  });
});
