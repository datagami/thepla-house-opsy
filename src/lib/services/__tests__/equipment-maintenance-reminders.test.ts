import { describe, it, expect } from "vitest";
import {
  getEquipmentMaintenanceRecipients,
  buildMaintenanceReminderEmail,
  partitionDueItems,
  DueItem,
} from "@/lib/services/equipment-maintenance-reminders";

const today = new Date("2026-06-08T09:00:00Z");

function item(over: Partial<DueItem> = {}): DueItem {
  return {
    id: "eq-1",
    name: "Fire Extinguisher",
    category: "FIRE_SAFETY",
    location: "Hot Kitchen",
    branchName: "Andheri",
    nextDueDate: new Date("2026-07-01"),
    reminderLeadDays: 30,
    snoozedUntil: null,
    status: "ACTIVE",
    ...over,
  };
}

describe("getEquipmentMaintenanceRecipients", () => {
  it("defaults to management@theplahouse.com", () => {
    const prev = process.env.EQUIPMENT_MAINTENANCE_EMAILS;
    delete process.env.EQUIPMENT_MAINTENANCE_EMAILS;
    expect(getEquipmentMaintenanceRecipients()).toEqual(["management@theplahouse.com"]);
    if (prev !== undefined) process.env.EQUIPMENT_MAINTENANCE_EMAILS = prev;
  });

  it("honors a comma-separated override (trimmed, empties dropped)", () => {
    const prev = process.env.EQUIPMENT_MAINTENANCE_EMAILS;
    process.env.EQUIPMENT_MAINTENANCE_EMAILS = "a@x.com, b@x.com ,";
    expect(getEquipmentMaintenanceRecipients()).toEqual(["a@x.com", "b@x.com"]);
    if (prev === undefined) delete process.env.EQUIPMENT_MAINTENANCE_EMAILS;
    else process.env.EQUIPMENT_MAINTENANCE_EMAILS = prev;
  });
});

describe("partitionDueItems", () => {
  it("splits into overdue and dueSoon, dropping OK and snoozed", () => {
    const items = [
      item({ id: "overdue", nextDueDate: new Date("2026-06-01") }),
      item({ id: "soon", nextDueDate: new Date("2026-07-01"), reminderLeadDays: 30 }),
      item({ id: "ok", nextDueDate: new Date("2026-12-01"), reminderLeadDays: 7 }),
      item({ id: "snoozed", nextDueDate: new Date("2026-06-01"), snoozedUntil: new Date("2026-06-20") }),
    ];
    const { overdue, dueSoon } = partitionDueItems(items, today);
    expect(overdue.map((i) => i.id)).toEqual(["overdue"]);
    expect(dueSoon.map((i) => i.id)).toEqual(["soon"]);
  });
});

describe("buildMaintenanceReminderEmail", () => {
  it("includes counts, item names, outlet and an Overdue section", () => {
    const { subject, html } = buildMaintenanceReminderEmail(
      [item({ id: "o", name: "Chest Freezer", nextDueDate: new Date("2026-06-01") })],
      [item({ id: "s", name: "Pest Control" })],
      today
    );
    expect(subject).toContain("1 Overdue");
    expect(subject).toContain("1 Due Soon");
    expect(html).toContain("Chest Freezer");
    expect(html).toContain("Pest Control");
    expect(html).toContain("Andheri");
    expect(html).toContain("Overdue");
  });
});
