import { addDays, addMonths, differenceInCalendarDays, startOfDay } from "date-fns";

export type ReminderState = "OVERDUE" | "DUE_SOON" | "OK" | "SNOOZED" | "NONE";

/** Next due date = serviceDate + frequencyMonths. Null when no positive frequency. */
export function computeNextDueDate(
  serviceDate: Date,
  frequencyMonths: number | null | undefined
): Date | null {
  if (!frequencyMonths || frequencyMonths <= 0) return null;
  return addMonths(serviceDate, frequencyMonths);
}

export interface ReminderInput {
  nextDueDate: Date | null;
  reminderLeadDays: number;
  snoozedUntil: Date | null;
  status: "ACTIVE" | "RETIRED";
}

/** Classify an item's reminder state relative to `today`. */
export function getReminderState(item: ReminderInput, today: Date): ReminderState {
  if (item.status === "RETIRED" || !item.nextDueDate) return "NONE";
  const t = startOfDay(today);
  if (item.snoozedUntil && startOfDay(item.snoozedUntil) > t) return "SNOOZED";
  const due = startOfDay(item.nextDueDate);
  if (due < t) return "OVERDUE";
  const windowOpens = addDays(due, -item.reminderLeadDays);
  if (windowOpens <= t) return "DUE_SOON";
  return "OK";
}

/** Whole calendar days from `from` to `target` (positive = future). */
export function daysUntil(target: Date, from: Date): number {
  return differenceInCalendarDays(startOfDay(target), startOfDay(from));
}
