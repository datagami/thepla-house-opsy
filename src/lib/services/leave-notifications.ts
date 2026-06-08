import type { LeaveType } from "@prisma/client";
import { sendEmail } from "@/lib/services/email";

export interface NewLeaveRequestNotification {
  leaveRequestId: string;
  requesterName: string | null;
  employeeName: string | null;
  leaveType: LeaveType;
  startDate: string | Date;
  endDate: string | Date;
  reason: string;
}

const DEFAULT_RECIPIENTS = [
  "management@theplahouse.com",
  "hr@theplahouse.com",
];

const formatDate = (d: string | Date): string =>
  new Date(d).toLocaleDateString(
    process.env.NEXT_PUBLIC_ATTENDANCE_LOCALE ?? "en-IN",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export function getLeaveNotificationRecipients(): string[] {
  const override = process.env.LEAVE_NOTIFICATION_EMAILS?.trim();
  if (!override) return DEFAULT_RECIPIENTS;
  return override
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

export function buildNewLeaveRequestEmail(
  input: NewLeaveRequestNotification
): { subject: string; html: string } {
  const employeeRaw = input.employeeName ?? "An employee";
  const employee = escapeHtml(employeeRaw);
  // Show "Submitted by" only when someone other than the employee filed it (e.g. a branch manager). Self-submissions pass requesterName === employeeName.
  const submittedBy =
    input.requesterName && input.requesterName !== input.employeeName
      ? `<p><strong>Submitted by:</strong> ${escapeHtml(input.requesterName)}</p>`
      : "";
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/leave-requests`;

  // Subject is plain text — use the unescaped name so "Sam & Co." doesn't reach the inbox as "Sam &amp; Co.".
  const subject = `New leave request: ${employeeRaw} (${input.leaveType})`;
  const html = `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #111;">
      <h2 style="margin: 0 0 12px;">New leave request</h2>
      <p><strong>Employee:</strong> ${employee}</p>
      ${submittedBy}
      <p><strong>Leave type:</strong> ${input.leaveType}</p>
      <p><strong>Dates:</strong> ${formatDate(input.startDate)} &ndash; ${formatDate(input.endDate)}</p>
      <p><strong>Reason:</strong> ${escapeHtml(input.reason)}</p>
      <p style="margin-top: 16px;">
        <a href="${link}" style="color: #2563eb;">Review leave requests</a>
      </p>
    </div>
  `.trim();

  return { subject, html };
}

export async function notifyNewLeaveRequest(
  input: NewLeaveRequestNotification
): Promise<void> {
  try {
    const to = getLeaveNotificationRecipients();
    if (to.length === 0) {
      console.warn(
        "[leave-notifications] No recipients configured; skipping email for leave request",
        input.leaveRequestId
      );
      return;
    }

    const { subject, html } = buildNewLeaveRequestEmail(input);
    await sendEmail({ to, subject, html });
  } catch (error) {
    console.error(
      "[leave-notifications] Failed to send new-leave-request email for",
      input.leaveRequestId,
      error
    );
  }
}
