import { z } from "zod";

export const EQUIPMENT_CATEGORIES = [
  "FIRE_SAFETY", "REFRIGERATION", "KITCHEN_EQUIPMENT", "ELECTRICAL",
  "PLUMBING", "PEST_CONTROL", "CLEANING", "OTHER",
] as const;

export const MAINTENANCE_TYPES = [
  "REPAIR", "SERVICE", "AMC", "INSPECTION", "REPLACEMENT", "OTHER",
] as const;

const uploadFile = z.object({ base64: z.string().min(1), contentType: z.string().min(1) });

export const equipmentCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  category: z.enum(EQUIPMENT_CATEGORIES),
  branchId: z.string().min(1, "Outlet is required"),
  location: z.string().trim().optional().nullable(),
  frequencyMonths: z.coerce.number().int().positive().nullable().optional(),
  reminderLeadDays: z.coerce.number().int().min(0).max(365).default(15),
  nextDueDate: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

// Items cannot be moved between outlets, so branchId is not updatable.
export const equipmentUpdateSchema = equipmentCreateSchema
  .omit({ branchId: true })
  .partial()
  .extend({
    status: z.enum(["ACTIVE", "RETIRED"]).optional(),
  });

export const maintenanceRecordCreateSchema = z.object({
  serviceDate: z.string().min(1),
  maintenanceType: z.enum(MAINTENANCE_TYPES),
  issue: z.string().trim().optional().nullable(),
  vendorName: z.string().trim().optional().nullable(),
  vendorContact: z.string().trim().optional().nullable(),
  cost: z.coerce.number().min(0).default(0),
  status: z.enum(["PENDING", "DONE"]).default("DONE"),
  remarks: z.string().trim().optional().nullable(),
  nextDueDate: z.string().optional().nullable(),
  bill: uploadFile.optional().nullable(),
  photos: z.array(uploadFile).optional().default([]),
});

export const snoozeSchema = z.object({
  // A parseable date string (date-only "YYYY-MM-DD" or full ISO), or null to clear.
  // Reject unparseable strings so a bad value is a 400, not a 500 / silent bad write.
  snoozedUntil: z
    .string()
    .refine((s) => !Number.isNaN(new Date(s).getTime()), "Invalid date")
    .nullable(),
});

export type EquipmentCreateInput = z.infer<typeof equipmentCreateSchema>;
export type MaintenanceRecordCreateInput = z.infer<typeof maintenanceRecordCreateSchema>;
