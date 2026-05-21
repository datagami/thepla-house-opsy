# User Status History — Design

**Status:** Approved
**Date:** 2026-05-21
**Author:** Kunal Sharma

## Goal

Fix the "attendance calendar shows every day as PENDING after a reactivated employee returns" bug by introducing a proper user status history. Days when the user was `INACTIVE` or `PARTIAL_INACTIVE` should render as inactive (neutral grey), not as pending attendance.

## Motivation

`User.status` is a single mutable field. The calendar in `src/components/attendance/detailed-attendance-calendar.tsx:80` paints every day in the month — when no attendance record exists for a day, it returns `"PENDING"` (yellow). For an employee who was inactive for part of the month and is now active again, the inactive days have no records and incorrectly render as pending attendance, suggesting HR action is required when none is.

The current schema also has no audit trail of status transitions. `approve/route.ts` logs `USER_STATUS_CHANGED` to ActivityLog; `update-status/route.ts` does not. Both routes silently lose history of intermediate transitions.

## Non-Goals

- Fixing date-range views beyond the per-user attendance calendar in this PR (salary calculations, monthly reports, attendance-conflicts views). Those can adopt the new helpers opportunistically as follow-ups.
- Backfilling perfect historical transitions for existing users. Backfill is best-effort using `createdAt` + `updatedAt`.
- Changing existing attendance records or `User.status` semantics.

## Decisions

| Decision | Choice |
|---|---|
| Storage | New table `UserStatusHistory` (append-only) |
| Backfill | Best-effort using `User.createdAt` (and `updatedAt` for non-ACTIVE users) |
| "Not working" classes | `INACTIVE` **and** `PARTIAL_INACTIVE` both treated as not-working for the calendar |
| Calendar tile for not-working day | New `INACTIVE` status, neutral grey |
| Audit gap fix | `update-status/route.ts` now writes both `UserStatusHistory` and `USER_STATUS_CHANGED` activity log |
| Scope | Calendar UX + plumbing only. Other consumers can adopt the helper in follow-ups. |

## Architecture

### Schema

`prisma/schema.prisma` — new model:

```prisma
model UserStatusHistory {
  id          String      @id @default(cuid())
  userId      String      @map("user_id")
  fromStatus  UserStatus? @map("from_status")
  toStatus    UserStatus  @map("to_status")
  changedAt   DateTime    @default(now()) @map("changed_at")
  changedById String?     @map("changed_by_id")
  reason      String?

  user      User  @relation("UserStatusHistoryUser", fields: [userId], references: [id], onDelete: Cascade)
  changedBy User? @relation("UserStatusHistoryChangedBy", fields: [changedById], references: [id], onDelete: SetNull)

  @@index([userId, changedAt])
  @@map("user_status_history")
}
```

`User` gets two new relations:
```prisma
statusHistory       UserStatusHistory[] @relation("UserStatusHistoryUser")
statusHistoryChanges UserStatusHistory[] @relation("UserStatusHistoryChangedBy")
```

Append-only. No updates, no deletes (except via cascade when the user is deleted).

### Backfill strategy

A one-off script `scripts/backfill-user-status-history.ts` seeds history rows for every existing user:

- For every user, insert `(fromStatus: null, toStatus: ACTIVE, changedAt: user.createdAt, reason: 'backfill: initial state')`. The assumption is everyone started ACTIVE.
- For users whose `status !== 'ACTIVE'`, also insert `(fromStatus: ACTIVE, toStatus: user.status, changedAt: user.updatedAt, reason: 'backfill: current state from updatedAt')`.

Idempotent: if the user already has any history rows, skip (so re-runs are safe).

This is an approximation. A user who went `ACTIVE → INACTIVE → ACTIVE → INACTIVE` over time will appear in the backfill as having only one transition. For the calendar bug at hand this is acceptable — going forward, every transition writes a new row, so accuracy improves monotonically. Documented as a known limitation.

### Helper service

`src/lib/services/user-status-history.ts`:

```ts
export const NOT_WORKING_STATUSES: ReadonlySet<UserStatus> = new Set([
  'INACTIVE',
  'PARTIAL_INACTIVE',
]);

export function resolveStatusOnDate(
  history: UserStatusHistory[],   // sorted ASC by changedAt
  date: Date,
): UserStatus | null;

export async function getInactiveDateKeysInRange(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<Set<string>>;          // returns { "yyyy-MM-dd", ... } for days the user was not-working
```

`resolveStatusOnDate` is a pure function — walks the sorted history and returns the status that was effective at `date`. Returns `null` if the user didn't exist yet (date < earliest `changedAt`).

`getInactiveDateKeysInRange` is the DB-touching helper. It loads the user's history (`where: { userId, changedAt: { lte: endDate } }, orderBy: { changedAt: 'asc' }`), iterates each day in `[startDate, endDate]`, computes the effective status, and returns a Set of `yyyy-MM-dd` keys for days where the status is in `NOT_WORKING_STATUSES`. Internally, each day in the range is evaluated at `endOfDay(day)` so that a status change happening any time during a day correctly classifies that calendar tile.

Returns an empty Set if there is no history (defensive — pre-backfill users won't crash the calendar).

### Write path

**`update-status/route.ts`** — after `prisma.user.update(...)`, insert:
```ts
await prisma.userStatusHistory.create({
  data: {
    userId,
    fromStatus: oldStatus,
    toStatus: newStatus,
    changedById: currentUser.id,
    reason: null,
  },
});
```
And log to ActivityLog:
```ts
await logEntityActivity(
  ActivityType.USER_STATUS_CHANGED,
  currentUser.id,
  'User',
  userId,
  `Status changed from ${oldStatus} to ${newStatus}`,
  { fromStatus: oldStatus, toStatus: newStatus },
  request,
);
```

(Wrapped in a transaction with the user update so a failure in either rolls back the other.)

**`approve/route.ts`** — already logs the activity. Add the history row in the same transaction.

### Read path (calendar)

**Server page** (`src/app/(auth)/attendance/[userId]/page.tsx`):

```ts
const inactiveDateKeys = await getInactiveDateKeysInRange(userId, startDate, endDate);
```

Pass `inactiveDateKeys` to `<DetailedAttendanceCalendar />` as a new prop (`Set<string>` of `yyyy-MM-dd`).

**Calendar component** (`src/components/attendance/detailed-attendance-calendar.tsx`):

```ts
const getAttendanceStatus = (date: Date) => {
  const dateKey = format(date, "yyyy-MM-dd");
  if (inactiveDateKeys.has(dateKey)) return "INACTIVE";
  const record = attendanceMap.get(dateKey);
  if (!record) return "PENDING";
  // ... existing branches
};

const statusColors = {
  ...,
  INACTIVE: "bg-gray-100 text-gray-400",
};
```

The `INACTIVE` check runs FIRST, so an inactive day with no record shows INACTIVE — not PENDING.

Clicking an INACTIVE tile is disabled (same UX as future dates — no edit affordance).

## Testing

- Unit tests for `resolveStatusOnDate`:
  - Returns the effective status at a given point in history.
  - Handles dates before the first entry (returns `null`).
  - Handles dates after the last entry (returns the final `toStatus`).
  - Handles multiple transitions correctly.
- Unit tests for `getInactiveDateKeysInRange` with a stubbed Prisma client:
  - All-active history → empty Set.
  - INACTIVE for the whole range → all `yyyy-MM-dd` keys present.
  - Transition mid-range → keys split at the transition date.
  - PARTIAL_INACTIVE counts as inactive.
- Manual smoke pass on the calendar after backfill.

## Migration & deployment order

1. Add the Prisma model.
2. Run `prisma migrate dev`.
3. Run the backfill script before deploying the new code paths (or right after — the helper handles empty history gracefully).
4. Code changes (write-path + read-path).
5. Verify on staging by toggling a test user INACTIVE → ACTIVE and checking the calendar.

## Risk and mitigation

- **Backfill imperfection.** Users with complex past status transitions show only the most-recent change. The calendar for those months may misclassify days. Acceptable for the immediate complaint (just-reactivated user); flagged as a known limitation in the script's log output.
- **Transaction failure during write.** The user-status update and history insert are wrapped in `prisma.$transaction` so either both happen or neither.
- **Schema migration.** New table, two new relations on User. No existing data is mutated. Migration is forward-only safe.
- **Performance.** `getInactiveDateKeysInRange` loads at most O(transitions) history rows for the user. For typical users (1-3 transitions in their lifetime), this is negligible. Indexed on `(userId, changedAt)`.

## Out of scope (explicit)

- Salary calculations, monthly attendance reports, attendance-conflicts views. These also benefit from `getInactiveDateKeysInRange` but the migration is opt-in per consumer.
- Multi-status workflows beyond what `UserStatus` already encodes.
- UI for "view this user's status history" — the data is captured; surfacing it can be a follow-up.
- Backfilling from ActivityLog `USER_STATUS_CHANGED` entries. The `approve/route.ts` log entries could in theory seed a more accurate history, but parsing free-text `description` strings is brittle. Keep backfill simple.
