# Leave Request Email Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Email all active HR/Management users whenever a new leave request is created.

**Architecture:** A new isolated service module (`leave-notifications.ts`) owns recipient resolution and HTML templating. A pure builder function produces the email content (easily unit-tested); an orchestrator function resolves a fixed recipient list (env-overridable, default `management@`/`hr@theplahouse.com`), builds the email, and sends it via the existing `sendEmail` helper. The orchestrator wraps all work in an internal try/catch and never throws, so a mail failure can never break leave-request creation. The `POST /api/leave-requests` route calls the orchestrator after the request is persisted.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Prisma 6 + PostgreSQL, Nodemailer (existing `sendEmail`), Vitest.

---

## File Structure

- **Create:** `src/lib/services/leave-notifications.ts` — owns recipient resolution + email template + send orchestration.
- **Create:** `src/lib/services/__tests__/leave-notifications.test.ts` — unit tests (pure builder + mocked-`sendEmail` orchestrator).
- **Modify:** `src/app/api/leave-requests/route.ts` — load requester name; call `notifyNewLeaveRequest` after persist + activity log.
- **Modify:** `.env.example` — document the optional `LEAVE_NOTIFICATION_EMAILS` var.

**Reference (read-only, do not change):**
- `src/lib/services/email.ts` — `sendEmail({ to, subject, html })`, throws on SMTP failure.
- `src/lib/services/document-expiry.ts` — existing "service owns its template + fixed recipients" pattern.
- `vitest.config.ts` — tests must live under `src/**/__tests__/**/*.test.ts`; env is `node`.

---

## Task 1: Email content builder (pure function)

**Files:**
- Create: `src/lib/services/leave-notifications.ts`
- Test: `src/lib/services/__tests__/leave-notifications.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/services/__tests__/leave-notifications.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildNewLeaveRequestEmail } from '@/lib/services/leave-notifications';

const base = {
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
    // date range rendered (year present at minimum)
    expect(html).toContain('2026');
  });

  it('uses NEXTAUTH_URL for the review link', () => {
    const prev = process.env.NEXTAUTH_URL;
    process.env.NEXTAUTH_URL = 'https://opsy.theplahouse.com';
    const { html } = buildNewLeaveRequestEmail(base);
    expect(html).toContain('https://opsy.theplahouse.com/leave-requests');
    process.env.NEXTAUTH_URL = prev;
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/__tests__/leave-notifications.test.ts`
Expected: FAIL — `buildNewLeaveRequestEmail` is not exported (module/file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/services/leave-notifications.ts` (the pure builder needs no imports; `sendEmail` is added in Task 2):

```ts
export interface NewLeaveRequestNotification {
  leaveRequestId: string;
  requesterName: string | null;
  employeeName: string | null;
  leaveType: string;
  startDate: string | Date;
  endDate: string | Date;
  reason: string;
}

const formatDate = (d: string | Date): string =>
  new Date(d).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export function buildNewLeaveRequestEmail(
  input: NewLeaveRequestNotification
): { subject: string; html: string } {
  const employee = input.employeeName ?? "An employee";
  const submittedBy =
    input.requesterName && input.requesterName !== input.employeeName
      ? `<p><strong>Submitted by:</strong> ${input.requesterName}</p>`
      : "";
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/leave-requests`;

  const subject = `New leave request: ${employee} (${input.leaveType})`;
  const html = `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #111;">
      <h2 style="margin: 0 0 12px;">New leave request</h2>
      <p><strong>Employee:</strong> ${employee}</p>
      ${submittedBy}
      <p><strong>Leave type:</strong> ${input.leaveType}</p>
      <p><strong>Dates:</strong> ${formatDate(input.startDate)} &ndash; ${formatDate(input.endDate)}</p>
      <p><strong>Reason:</strong> ${input.reason}</p>
      <p style="margin-top: 16px;">
        <a href="${link}" style="color: #2563eb;">Review leave requests</a>
      </p>
    </div>
  `.trim();

  return { subject, html };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/services/__tests__/leave-notifications.test.ts`
Expected: PASS (3 tests in the `buildNewLeaveRequestEmail` describe block).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/leave-notifications.ts src/lib/services/__tests__/leave-notifications.test.ts
git commit -m "feat(leave): add new-leave-request email content builder"
```

---

## Task 2: Recipient resolution + send orchestration

**Files:**
- Modify: `src/lib/services/leave-notifications.ts`
- Test: `src/lib/services/__tests__/leave-notifications.test.ts`

- [ ] **Step 1: Write the failing test**

At the **top** of `src/lib/services/__tests__/leave-notifications.test.ts`, extend the vitest import to `import { describe, it, expect, vi, beforeEach } from 'vitest';`, add the imports below, and mock `@/lib/services/email` (place the `vi.mock` directly under the imports):

```ts
import { notifyNewLeaveRequest, getLeaveNotificationRecipients } from '@/lib/services/leave-notifications';
import { sendEmail } from '@/lib/services/email';

vi.mock('@/lib/services/email', () => ({
  sendEmail: vi.fn(),
}));

const sendEmailMock = sendEmail as unknown as ReturnType<typeof vi.fn>;
```

Then append these describe blocks:

```ts
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

  it('does not send when the recipient list resolves empty', async () => {
    process.env.LEAVE_NOTIFICATION_EMAILS = '   ';
    await notifyNewLeaveRequest(base);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('never throws when sendEmail fails (email failure cannot break creation)', async () => {
    sendEmailMock.mockRejectedValue(new Error('SMTP down'));
    await expect(notifyNewLeaveRequest(base)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/__tests__/leave-notifications.test.ts`
Expected: FAIL — `notifyNewLeaveRequest` / `getLeaveNotificationRecipients` are not exported yet.

- [ ] **Step 3: Write minimal implementation**

Add the `sendEmail` import at the top of `src/lib/services/leave-notifications.ts`:

```ts
import { sendEmail } from "@/lib/services/email";
```

Then append to the same file:

```ts
const DEFAULT_RECIPIENTS = [
  "management@theplahouse.com",
  "hr@theplahouse.com",
];

export function getLeaveNotificationRecipients(): string[] {
  const override = process.env.LEAVE_NOTIFICATION_EMAILS;
  if (!override) return DEFAULT_RECIPIENTS;
  return override
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/services/__tests__/leave-notifications.test.ts`
Expected: PASS (all builder + recipient + orchestrator tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/leave-notifications.ts src/lib/services/__tests__/leave-notifications.test.ts
git commit -m "feat(leave): send new-leave-request email to role mailboxes"
```

---

## Task 3: Wire notification into the create-leave-request route

**Files:**
- Modify: `src/app/api/leave-requests/route.ts`

This route's existing tests hit a real database, so we keep this task as an integration edit verified by build + manual check rather than a new DB-backed unit test (the notification behavior itself is fully covered by Task 1–2). The orchestrator never throws, so no behavioral test of the route's response code is required.

- [ ] **Step 0: Document the optional env var in `.env.example`**

Add near the existing `SMTP_*` / `EMAIL_FROM` lines in `.env.example`:

```
# Optional: comma-separated recipients for new-leave-request notifications.
# Defaults to management@theplahouse.com,hr@theplahouse.com when unset.
# LEAVE_NOTIFICATION_EMAILS="management@theplahouse.com,hr@theplahouse.com"
```

- [ ] **Step 1: Add the import**

At the top of `src/app/api/leave-requests/route.ts`, alongside the existing imports, add:

```ts
import { notifyNewLeaveRequest } from "@/lib/services/leave-notifications";
```

- [ ] **Step 2: Resolve requester and employee names, then notify**

In the `POST` handler, locate the block immediately after the `await logEntityActivity(...)` call and before `return NextResponse.json(leaveRequest);` (around line 155). Insert:

```ts
    // Notify HR/Management of the new leave request (best-effort; never blocks creation)
    const requester = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { name: true },
    });
    const requesterName = requester?.name ?? null;
    const employeeName =
      targetUserId === sessionUserId ? requesterName : targetUserName;

    await notifyNewLeaveRequest({
      leaveRequestId: leaveRequest.id,
      requesterName,
      employeeName,
      leaveType,
      startDate,
      endDate,
      reason,
    });

    return NextResponse.json(leaveRequest);
```

(Replace the existing lone `return NextResponse.json(leaveRequest);` with the block above — note `targetUserName` and `targetUserId` are already in scope from earlier in the handler, as are `leaveType`, `startDate`, `endDate`, `reason` from the request body.)

- [ ] **Step 3: Type-check / build**

Run: `npx tsc --noEmit`
Expected: no new type errors in `src/app/api/leave-requests/route.ts` or `src/lib/services/leave-notifications.ts`.

(If `tsc` is not configured standalone, run `npm run build` and confirm it compiles.)

- [ ] **Step 4: Run the full unit suite**

Run: `npm run test`
Expected: PASS, including the new `leave-notifications` tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/leave-requests/route.ts .env.example
git commit -m "feat(leave): notify role mailboxes by email on new leave request"
```

---

## Task 4: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Ensure SMTP + URL env vars are set**

Confirm `.env` has `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, and `NEXTAUTH_URL` (e.g. `http://localhost:3000` locally). These already power document-expiry/attendance emails. `LEAVE_NOTIFICATION_EMAILS` is optional — leave unset to use the `management@`/`hr@theplahouse.com` defaults.

- [ ] **Step 2: Restart dev server**

Per project convention, kill and restart the dev server so the latest code is served:

```bash
# stop the running `next dev`, then:
npm run dev
```

- [ ] **Step 3: Submit a test leave request**

Log in as an EMPLOYEE (or BRANCH_MANAGER) and submit a leave request via `/leave-requests/new`. Confirm:
- The request is created (200 / appears in the list).
- The role mailboxes (`management@`/`hr@theplahouse.com`, or your `LEAVE_NOTIFICATION_EMAILS` override) receive an email with correct employee name, leave type, date range, reason, and a `Review leave requests` link pointing at `${NEXTAUTH_URL}/leave-requests`.

- [ ] **Step 4: Verify failure isolation (optional)**

Temporarily set an invalid `SMTP_HOST`, submit a request, and confirm the request is still created successfully (the email error is logged but does not surface to the user). Restore `SMTP_HOST` afterward.

---

## Self-Review Notes

- **Spec coverage:** trigger on create (Task 3) ✓; recipients = fixed role mailboxes, env-overridable, no role query (Task 2) ✓; single email to list (Task 2) ✓; new `leave-notifications.ts` module mirroring `document-expiry.ts` (Task 1–2) ✓; `NEXTAUTH_URL` link reused (Task 1), optional `LEAVE_NOTIFICATION_EMAILS` documented (Task 3 Step 0) ✓; email failure never breaks creation (Task 2 throw-safety test + Task 4 manual) ✓; out-of-scope items (approval/rejection/ack) not implemented ✓.
- **Type consistency:** `NewLeaveRequestNotification` interface, `buildNewLeaveRequestEmail`, and `notifyNewLeaveRequest` signatures are identical across Tasks 1–3.
- **No placeholders:** every code step contains complete, runnable code.
