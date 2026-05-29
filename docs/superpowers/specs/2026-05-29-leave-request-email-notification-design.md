# Leave Request Email Notification — Design

**Date:** 2026-05-29
**Status:** Approved for planning
**Author:** Kunal Sharma (with Claude)

## Goal

When an employee (or a branch manager on an employee's behalf) submits a new
leave request, send an email notification to all HR and Management users so they
can review and act on it. Currently leave requests only write to the activity
log; no notification is sent to anyone.

## Scope

**In scope**
- One trigger: a **new** leave request is created (`POST /api/leave-requests`).
- Recipients: a **fixed list of role mailboxes** —
  `management@theplahouse.com` and `hr@theplahouse.com` — overridable via the
  optional `LEAVE_NOTIFICATION_EMAILS` env var (comma-separated). No per-user
  role lookup.
- A single email per request, addressed to the recipient list.

**Out of scope** (explicitly deferred)
- Approval / rejection emails to the employee.
- Employee acknowledgement / confirmation email.
- Branch-manager-targeted notifications.
- Any user-facing notification preferences / opt-out.

## Context & Constraints

- **Stack:** Next.js 15 (App Router) + TypeScript, Prisma 6 + PostgreSQL,
  NextAuth, Nodemailer.
- **Existing email helper:** `src/lib/services/email.ts` exports
  `sendEmail({ to, subject, html })`. It builds a Nodemailer transport from
  `SMTP_*` env vars and **throws** on SMTP failure.
- **Existing pattern to mirror:** `src/lib/services/document-expiry.ts` owns its
  own HTML templating and calls `sendEmail`. We follow the same "service owns its
  template" pattern.
- **Recipient safety:** Most non-management users have placeholder / made-up
  email addresses. Because we email fixed role mailboxes
  (`management@`/`hr@theplahouse.com`) rather than individual user records, there
  is no bounce concern and no dependence on the accuracy of per-user emails.
- **Base URL:** Reuse the existing `NEXTAUTH_URL` env var for links
  (`http://localhost:3000` locally, `https://opsy.theplahouse.com` in prod).
  No new env var is introduced.

## Architecture

### New module: `src/lib/services/leave-notifications.ts`

Keeps the API route lean and isolates templating + recipient resolution, mirroring
`document-expiry.ts`.

Exports one function:

```ts
notifyNewLeaveRequest(input: {
  leaveRequestId: string;
  requesterName: string | null;   // who submitted (session user)
  employeeName: string | null;    // whose leave it is (may equal requester)
  leaveType: string;
  startDate: string | Date;
  endDate: string | Date;
  reason: string;
}): Promise<void>
```

Responsibilities:
1. **Resolve recipients** — read the fixed list from `LEAVE_NOTIFICATION_EMAILS`
   (comma-separated) if set, otherwise default to
   `["management@theplahouse.com", "hr@theplahouse.com"]`. No database query.
2. **Build the HTML email** — subject like
   `New leave request: <employeeName> (<leaveType>)`. Body includes: employee
   name, who submitted it (if different from the employee), leave type, date
   range, reason, and a link to `${NEXTAUTH_URL}/leave-requests`.
3. **Send** — call `sendEmail({ to: recipients, subject, html })`.

This function does **not** throw to its caller; it wraps its own work so a
failure is logged but contained. (See Error Handling.)

### Integration point: `src/app/api/leave-requests/route.ts`

In the `POST` handler, after the `logEntityActivity(...)` call and before the
final `return NextResponse.json(leaveRequest)` (around line 155):

- Determine `requesterName` and `employeeName`:
  - `requesterName` = the session user's name. The route currently does not load
    it, so fetch the session user's `name` (single `prisma.user.findUnique`
    selecting `name`), or include it when resolving the target user.
  - `employeeName` = `targetUserName` when the manager created it for an employee;
    otherwise the requester's own name (self-submission).
- Call `notifyNewLeaveRequest({...})` inside a `try/catch`. We **await** it so
  send errors surface in server logs; the `catch` logs and swallows the error.

### Data flow

```
employee/manager submits form
  → POST /api/leave-requests
    → validate + create LeaveRequest (PENDING)
    → logEntityActivity(LEAVE_REQUEST_CREATED)
    → notifyNewLeaveRequest(...)        [try/catch, await]
        → resolve fixed recipient list (env or default)
        → build HTML
        → sendEmail(...)
    → return created leaveRequest (200) regardless of email outcome
```

## Error Handling (key decision)

Email delivery **must never break request creation.** The `notifyNewLeaveRequest`
call is wrapped in `try/catch` in the route; any error (SMTP failure, no
recipients, etc.) is logged via `console.error` and the request still returns the
created leave request with a 200. We `await` the call (rather than fire-and-forget)
so failures are visible in logs at the cost of a small added latency on submit —
acceptable for this low-frequency action.

## Testing

- **Unit:** recipient resolution (defaults to the two role mailboxes; honors
  `LEAVE_NOTIFICATION_EMAILS` override) and the HTML builder (contains employee
  name, dates, leave type, reason, and the `NEXTAUTH_URL`-based link). Mock
  `sendEmail`.
- **Unit:** route still returns 200 when `sendEmail` throws (email failure is
  contained).
- **Manual:** submit a leave request in dev and confirm an email arrives at the
  configured HR/Management address(es) with correct content and link.

## Files Touched

- **New:** `src/lib/services/leave-notifications.ts`
- **Edit:** `src/app/api/leave-requests/route.ts` (call the notifier; load
  requester name)
- **Tests:** new test file(s) for the notifications module / route behavior.
- **Edit:** `.env.example` — add the optional `LEAVE_NOTIFICATION_EMAILS` var
  with the two default addresses as a comment. `NEXTAUTH_URL` is reused for email
  links and already exists.
