import type { LeaveType } from "@prisma/client";
import { differenceInCalendarDays, format } from "date-fns";
import { sendEmail, type EmailAttachment } from "@/lib/services/email";

export interface NewLeaveRequestNotification {
  leaveRequestId: string;
  // Auto-incrementing numeric id used for the printable Ref. No. on the form.
  leaveRequestNumId?: number | null;
  // When the leave request was filed (DB createdAt). Used for the Ref. No.
  // date segment and the "Filed on" field. Falls back to "now" if missing.
  filedAt?: string | Date | null;
  requesterName: string | null;
  employeeName: string | null;
  // Extra employee fields needed to render the attached PDF form. All optional
  // — if missing, the PDF still renders with "—" placeholders.
  employeeNumId?: number | null;
  employeeDepartment?: string | null;
  employeeBranch?: string | null;
  employeeDoj?: string | Date | null;
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

// Build the printable Ref. No. used on the form: LR/YYMM/####.
function buildReferenceNo(numId: number, filedAt: Date): string {
  const yy = String(filedAt.getFullYear()).slice(-2);
  const mm = String(filedAt.getMonth() + 1).padStart(2, "0");
  return `LR/${yy}${mm}/${String(numId).padStart(4, "0")}`;
}

// Render the leave application PDF for attachment. Imported lazily so the
// heavy @react-pdf/renderer module isn't pulled into every callsite that
// imports this notifications module. Returns null on failure so the email
// can still be sent without an attachment.
async function buildLeaveApplicationAttachment(
  input: NewLeaveRequestNotification
): Promise<EmailAttachment | null> {
  try {
    const { renderLeaveApplicationPdf } = await import(
      "@/lib/services/leave-application-pdf"
    );
    const filedAt = input.filedAt ? new Date(input.filedAt) : new Date();
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    const refNo =
      input.leaveRequestNumId != null
        ? buildReferenceNo(input.leaveRequestNumId, filedAt)
        : `LR/${input.leaveRequestId.slice(-6).toUpperCase()}`;
    const pdfBuffer = await renderLeaveApplicationPdf({
      refNo,
      filedOn: format(filedAt, "d MMMM yyyy"),
      employeeName: input.employeeName ?? "An employee",
      employeeNumId: input.employeeNumId ?? null,
      departmentName: input.employeeDepartment ?? null,
      branchName: input.employeeBranch ?? null,
      doj: input.employeeDoj ? format(new Date(input.employeeDoj), "d MMMM yyyy") : null,
      leaveType: input.leaveType,
      startDate: format(start, "d MMMM yyyy"),
      endDate: format(end, "d MMMM yyyy"),
      totalDays: differenceInCalendarDays(end, start) + 1,
      reason: input.reason,
    });
    // Safe filename: replace anything outside letters/numbers/.- so SMTP and
    // mail clients don't choke on names like "Sam & Co." — but using the
    // Unicode `\p{L}\p{N}` classes (with the /u flag) so Devanagari and
    // other non-ASCII scripts survive instead of collapsing to underscores.
    // If the cleaned name is empty (rare — pure punctuation), fall back to
    // "employee" so the filename always has a meaningful base.
    const cleaned = (input.employeeName ?? "employee")
      .replace(/[^\p{L}\p{N}.-]+/gu, "_")
      .replace(/^_+|_+$/g, "");
    const safeName = cleaned.length > 0 ? cleaned : "employee";
    return {
      filename: `leave-application-${safeName}-${refNo.replace(/\//g, "-")}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    };
  } catch (error) {
    console.error(
      "[leave-notifications] Failed to render leave application PDF; sending email without attachment for",
      input.leaveRequestId,
      error
    );
    return null;
  }
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
    const attachment = await buildLeaveApplicationAttachment(input);
    await sendEmail({
      to,
      subject,
      html,
      attachments: attachment ? [attachment] : undefined,
    });
  } catch (error) {
    console.error(
      "[leave-notifications] Failed to send new-leave-request email for",
      input.leaveRequestId,
      error
    );
  }
}
