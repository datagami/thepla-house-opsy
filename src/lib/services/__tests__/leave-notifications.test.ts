import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildNewLeaveRequestEmail,
  notifyNewLeaveRequest,
  getLeaveNotificationRecipients,
  NewLeaveRequestNotification,
} from '@/lib/services/leave-notifications';
import { sendEmail } from '@/lib/services/email';

vi.mock('@/lib/services/email', () => ({
  sendEmail: vi.fn(),
}));

// PDF generation is heavy (loads @react-pdf/renderer) — mock it so unit tests
// stay fast. Tests that need to verify attachment shape inspect the mocked
// return value.
vi.mock('@/lib/services/leave-application-pdf', () => ({
  renderLeaveApplicationPdf: vi.fn(async () => Buffer.from('FAKE-PDF')),
}));

const sendEmailMock = sendEmail as unknown as ReturnType<typeof vi.fn>;

const base: NewLeaveRequestNotification = {
  leaveRequestId: 'lr-1',
  requesterName: 'Asha Rao',
  employeeName: 'Asha Rao',
  leaveType: 'CASUAL',
  startDate: '2026-06-01',
  endDate: '2026-06-03',
  reason: 'Family function',
};

describe('buildNewLeaveRequestEmail', () => {
  it('includes employee, leave type, dates and reason in subject/body', () => {
    const { subject, html } = buildNewLeaveRequestEmail(base);
    expect(subject).toContain('Asha Rao');
    expect(subject).toContain('CASUAL');
    expect(html).toContain('Asha Rao');
    expect(html).toContain('CASUAL');
    expect(html).toContain('Family function');
    expect(html).toContain('2026');
  });

  it('uses NEXTAUTH_URL for the review link', () => {
    const prev = process.env.NEXTAUTH_URL;
    process.env.NEXTAUTH_URL = 'https://opsy.theplahouse.com';
    const { html } = buildNewLeaveRequestEmail(base);
    expect(html).toContain('https://opsy.theplahouse.com/leave-requests');
    if (prev === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = prev;
  });

  it('uses the raw name in the plain-text subject but escapes it in the HTML body', () => {
    const { subject, html } = buildNewLeaveRequestEmail({
      ...base,
      requesterName: 'Sam & Co.',
      employeeName: 'Sam & Co.',
    });
    expect(subject).toContain('Sam & Co.');
    expect(subject).not.toContain('&amp;');
    expect(html).toContain('Sam &amp; Co.');
  });

  it('shows "Submitted by" only when requester differs from employee', () => {
    const self = buildNewLeaveRequestEmail(base);
    expect(self.html).not.toContain('Submitted by');

    const onBehalf = buildNewLeaveRequestEmail({
      ...base,
      requesterName: 'Branch Manager',
      employeeName: 'Asha Rao',
    });
    expect(onBehalf.html).toContain('Submitted by');
    expect(onBehalf.html).toContain('Branch Manager');
  });
});

describe('getLeaveNotificationRecipients', () => {
  it('defaults to the management and hr role mailboxes', () => {
    const prev = process.env.LEAVE_NOTIFICATION_EMAILS;
    delete process.env.LEAVE_NOTIFICATION_EMAILS;
    expect(getLeaveNotificationRecipients()).toEqual([
      'management@theplahouse.com',
      'hr@theplahouse.com',
    ]);
    if (prev !== undefined) process.env.LEAVE_NOTIFICATION_EMAILS = prev;
  });

  it('honors the LEAVE_NOTIFICATION_EMAILS override (comma-separated, trimmed)', () => {
    const prev = process.env.LEAVE_NOTIFICATION_EMAILS;
    process.env.LEAVE_NOTIFICATION_EMAILS = 'a@x.com, b@x.com ';
    expect(getLeaveNotificationRecipients()).toEqual(['a@x.com', 'b@x.com']);
    if (prev === undefined) delete process.env.LEAVE_NOTIFICATION_EMAILS;
    else process.env.LEAVE_NOTIFICATION_EMAILS = prev;
  });
});

describe('notifyNewLeaveRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LEAVE_NOTIFICATION_EMAILS;
  });

  it('sends one email to the default role mailboxes', async () => {
    sendEmailMock.mockResolvedValue({ messageId: 'ok' });
    await notifyNewLeaveRequest(base);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const arg = sendEmailMock.mock.calls[0][0];
    expect(arg.to).toEqual(['management@theplahouse.com', 'hr@theplahouse.com']);
    expect(arg.subject).toContain('CASUAL');
  });

  it('falls back to defaults when LEAVE_NOTIFICATION_EMAILS is whitespace-only', async () => {
    sendEmailMock.mockResolvedValue({ messageId: 'ok' });
    process.env.LEAVE_NOTIFICATION_EMAILS = '   ';
    await notifyNewLeaveRequest(base);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const arg = sendEmailMock.mock.calls[0][0];
    expect(arg.to).toEqual(['management@theplahouse.com', 'hr@theplahouse.com']);
  });

  it('does not send when the recipient list resolves empty (only commas)', async () => {
    process.env.LEAVE_NOTIFICATION_EMAILS = ',,,';
    await notifyNewLeaveRequest(base);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('never throws when sendEmail fails (email failure cannot break creation)', async () => {
    sendEmailMock.mockRejectedValue(new Error('SMTP down'));
    await expect(notifyNewLeaveRequest(base)).resolves.toBeUndefined();
  });

  it('attaches the leave application form as a PDF', async () => {
    sendEmailMock.mockResolvedValue({ messageId: 'ok' });
    await notifyNewLeaveRequest({
      ...base,
      leaveRequestNumId: 42,
      filedAt: '2026-05-29T10:00:00.000Z',
    });
    const arg = sendEmailMock.mock.calls[0][0];
    expect(arg.attachments).toBeDefined();
    expect(arg.attachments).toHaveLength(1);
    const a = arg.attachments[0];
    expect(a.contentType).toBe('application/pdf');
    expect(a.filename).toMatch(/^leave-application-.*\.pdf$/);
    expect(Buffer.isBuffer(a.content)).toBe(true);
  });

  it('still sends the email (without attachment) if PDF rendering fails', async () => {
    sendEmailMock.mockResolvedValue({ messageId: 'ok' });
    const { renderLeaveApplicationPdf } = await import(
      '@/lib/services/leave-application-pdf'
    );
    (renderLeaveApplicationPdf as unknown as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('pdf render boom'));
    await notifyNewLeaveRequest(base);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const arg = sendEmailMock.mock.calls[0][0];
    expect(arg.attachments).toBeUndefined();
  });
});
