import { prisma } from "@/lib/prisma";
import { sendEmail } from "./email";
import { logActivity } from "./activity-log";
import { getReminderState, daysUntil } from "./maintenance-schedule";
import { ActivityType } from "@prisma/client";
import { format } from "date-fns";

export interface DueItem {
  id: string;
  name: string;
  category: string;
  location: string | null;
  branchName: string;
  nextDueDate: Date | null;
  reminderLeadDays: number;
  snoozedUntil: Date | null;
  status: "ACTIVE" | "RETIRED";
}

const DEFAULT_RECIPIENTS = ["management@theplahouse.com"];

export function getEquipmentMaintenanceRecipients(): string[] {
  const raw = process.env.EQUIPMENT_MAINTENANCE_EMAILS;
  if (!raw) return DEFAULT_RECIPIENTS;
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_RECIPIENTS;
}

export function partitionDueItems(items: DueItem[], today: Date) {
  const overdue: DueItem[] = [];
  const dueSoon: DueItem[] = [];
  for (const it of items) {
    const state = getReminderState(it, today);
    if (state === "OVERDUE") overdue.push(it);
    else if (state === "DUE_SOON") dueSoon.push(it);
  }
  return { overdue, dueSoon };
}

function renderSection(title: string, items: DueItem[], color: string, today: Date): string {
  if (items.length === 0) return "";
  let html = `<h3 style="color:${color};border-bottom:2px solid ${color};padding-bottom:5px;">${title} (${items.length})</h3>`;
  html += `<ul style="list-style:none;padding-left:0;">`;
  for (const it of items) {
    const due = it.nextDueDate ? new Date(it.nextDueDate) : null;
    const when = due
      ? `${format(due, "PPP")} (${daysUntil(due, today)} days)`
      : "—";
    html += `
      <li style="margin-bottom:10px;padding:10px;background:#f9f9f9;border-left:4px solid ${color};">
        <strong>${it.name}</strong> (${it.category})<br/>
        <strong>Outlet:</strong> ${it.branchName}${it.location ? ` — ${it.location}` : ""}<br/>
        <strong>Next due:</strong> ${when}
      </li>`;
  }
  html += `</ul>`;
  return html;
}

export function buildMaintenanceReminderEmail(
  overdue: DueItem[],
  dueSoon: DueItem[],
  today: Date
): { subject: string; html: string } {
  const subject = `Opsy Maintenance: ${overdue.length} Overdue, ${dueSoon.length} Due Soon`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#333;">Equipment Maintenance Report</h2>
      <p>Daily automated report of equipment &amp; services due for maintenance.</p>
      ${renderSection("🚨 Overdue (Action Required!)", overdue, "#dc2626", today)}
      ${renderSection("⏰ Due Soon", dueSoon, "#ca8a04", today)}
      <p style="margin-top:20px;font-size:12px;color:#666;">
        Generated automatically by Opsy. Log in to record maintenance or snooze an item.
      </p>
    </div>`;
  return { subject, html };
}

/** Fetch all active, non-snoozed items with a due date — partitioned in JS by per-item lead. */
export async function getCandidateItems(today: Date): Promise<DueItem[]> {
  // This SQL is a coarse prefilter (it excludes clearly-snoozed rows). The
  // authoritative snooze/overdue/due-soon classification is done in JS by
  // partitionDueItems -> getReminderState (start-of-day, per-item lead time).
  const rows = await prisma.equipment.findMany({
    where: {
      status: "ACTIVE",
      nextDueDate: { not: null },
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: today } }],
    },
    select: {
      id: true,
      name: true,
      category: true,
      location: true,
      nextDueDate: true,
      reminderLeadDays: true,
      snoozedUntil: true,
      status: true,
      branch: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    location: r.location,
    branchName: r.branch.name,
    nextDueDate: r.nextDueDate,
    reminderLeadDays: r.reminderLeadDays,
    snoozedUntil: r.snoozedUntil,
    status: r.status as "ACTIVE" | "RETIRED",
  }));
}

export async function processEquipmentMaintenanceReminders() {
  const today = new Date();
  const candidates = await getCandidateItems(today);
  const { overdue, dueSoon } = partitionDueItems(candidates, today);
  const total = overdue.length + dueSoon.length;

  if (total === 0) {
    return { processed: 0, emailsSent: 0, details: { overdue: 0, dueSoon: 0 } };
  }

  const recipients = getEquipmentMaintenanceRecipients();
  let emailsSent = 0;

  if (recipients.length > 0) {
    const { subject, html } = buildMaintenanceReminderEmail(overdue, dueSoon, today);
    try {
      await sendEmail({ to: recipients, subject, html });
      emailsSent = 1;
      console.log(
        `Maintenance reminder email sent to ${recipients.join(", ")} — ${overdue.length} overdue, ${dueSoon.length} due soon.`
      );
      await logActivity({
        activityType: ActivityType.EQUIPMENT_MAINTENANCE_ALERT,
        description: `Daily maintenance reminder sent. ${overdue.length} overdue, ${dueSoon.length} due soon.`,
        metadata: { recipients, counts: { overdue: overdue.length, dueSoon: dueSoon.length }, automated: true },
      });
    } catch (error) {
      console.error("Failed to send maintenance reminder email:", error);
    }
  }

  return {
    processed: total,
    emailsSent,
    details: { overdue: overdue.length, dueSoon: dueSoon.length },
  };
}
