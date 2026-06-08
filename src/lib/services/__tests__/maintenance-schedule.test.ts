import { describe, it, expect } from "vitest";
import {
  computeNextDueDate,
  getReminderState,
  daysUntil,
} from "@/lib/services/maintenance-schedule";

describe("computeNextDueDate", () => {
  it("adds frequencyMonths to the service date", () => {
    const due = computeNextDueDate(new Date("2026-01-15T10:00:00Z"), 12);
    expect(due?.toISOString().slice(0, 10)).toBe("2027-01-15");
  });

  it("returns null when frequency is null, zero, or negative", () => {
    expect(computeNextDueDate(new Date("2026-01-15"), null)).toBeNull();
    expect(computeNextDueDate(new Date("2026-01-15"), 0)).toBeNull();
    expect(computeNextDueDate(new Date("2026-01-15"), -3)).toBeNull();
  });
});

describe("getReminderState", () => {
  const today = new Date("2026-06-08T09:00:00Z");
  const base = {
    nextDueDate: new Date("2026-07-01"),
    reminderLeadDays: 30,
    snoozedUntil: null as Date | null,
    status: "ACTIVE" as const,
  };

  it("is NONE for retired items or items with no due date", () => {
    expect(getReminderState({ ...base, status: "RETIRED" }, today)).toBe("NONE");
    expect(getReminderState({ ...base, nextDueDate: null }, today)).toBe("NONE");
  });

  it("is OVERDUE when due date is before today", () => {
    expect(getReminderState({ ...base, nextDueDate: new Date("2026-06-07") }, today)).toBe("OVERDUE");
  });

  it("is DUE_SOON when today is within reminderLeadDays of the due date", () => {
    expect(getReminderState(base, today)).toBe("DUE_SOON");
  });

  it("is OK when the due date is further out than the lead window", () => {
    expect(getReminderState({ ...base, reminderLeadDays: 7 }, today)).toBe("OK");
  });

  it("is SNOOZED when snoozedUntil is in the future, even if overdue", () => {
    expect(
      getReminderState(
        { ...base, nextDueDate: new Date("2026-06-01"), snoozedUntil: new Date("2026-06-20") },
        today
      )
    ).toBe("SNOOZED");
  });

  it("ignores a snooze that has already passed", () => {
    expect(
      getReminderState(
        { ...base, nextDueDate: new Date("2026-06-01"), snoozedUntil: new Date("2026-06-05") },
        today
      )
    ).toBe("OVERDUE");
  });
});

describe("daysUntil", () => {
  it("is positive in the future, negative in the past", () => {
    expect(daysUntil(new Date("2026-06-18"), new Date("2026-06-08"))).toBe(10);
    expect(daysUntil(new Date("2026-06-03"), new Date("2026-06-08"))).toBe(-5);
  });
});
