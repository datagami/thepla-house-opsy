# User Status History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track every `User.status` transition in a `UserStatusHistory` table so the per-user attendance calendar can distinguish "inactive day" from "active day with no attendance record" — fixing the bug where reactivated employees show every prior day as yellow PENDING.

**Architecture:** Append-only history table + Prisma migration + one-off backfill script + helper service that returns a `Set<yyyy-MM-dd>` of inactive days in a range. Calendar checks the set first; days in it render as grey INACTIVE instead of yellow PENDING. Write path on `update-status` and `approve` routes also writes a `USER_STATUS_CHANGED` activity log (closing a pre-existing audit gap).

**Tech Stack:** Next.js 14 App Router · Prisma · PostgreSQL · Vitest (node env). Branch: `feature/user-status-history` (already created).

**Spec:** `docs/superpowers/specs/2026-05-21-user-status-history-design.md`

---

## Task 1: Add `UserStatusHistory` Prisma model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the model**

After the existing enums (around line 30), keep them. Append a new model definition above the closing of the file (or near other relational tables — pick a clean location). The model body must match the spec exactly:

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

- [ ] **Step 2: Add relations to `User`**

Inside `model User { ... }` (around the existing relation block — search for `attendance         Attendance[]` to find that section), append two new relation lines:

```prisma
  statusHistory        UserStatusHistory[] @relation("UserStatusHistoryUser")
  statusHistoryChanges UserStatusHistory[] @relation("UserStatusHistoryChangedBy")
```

- [ ] **Step 3: Run the migration**

```bash
npx prisma migrate dev --name add_user_status_history
```

Expected: a new SQL migration file is created under `prisma/migrations/`, and the local DB has the new table.

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: TypeScript types for `prisma.userStatusHistory` are now available.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

Expected: 0 NEW errors (one pre-existing `TS2578` in `salary-create.test.ts:113` is unrelated; ignore).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): add UserStatusHistory table for status audit + queries"
```

---

## Task 2: Write the helper service with TDD

**Files:**
- Create: `src/lib/services/user-status-history.ts`
- Create: `src/lib/services/__tests__/user-status-history.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/services/__tests__/user-status-history.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveStatusOnDate, NOT_WORKING_STATUSES } from '@/lib/services/user-status-history';
import type { UserStatusHistory } from '@prisma/client';

const mkRow = (toStatus: 'ACTIVE' | 'INACTIVE' | 'PARTIAL_INACTIVE' | 'PENDING', changedAt: string, fromStatus: 'ACTIVE' | 'INACTIVE' | 'PARTIAL_INACTIVE' | 'PENDING' | null = null): UserStatusHistory => ({
  id: `r-${changedAt}`,
  userId: 'u1',
  fromStatus: fromStatus as any,
  toStatus: toStatus as any,
  changedAt: new Date(changedAt),
  changedById: null,
  reason: null,
});

describe('NOT_WORKING_STATUSES', () => {
  it('contains INACTIVE and PARTIAL_INACTIVE', () => {
    expect(NOT_WORKING_STATUSES.has('INACTIVE' as any)).toBe(true);
    expect(NOT_WORKING_STATUSES.has('PARTIAL_INACTIVE' as any)).toBe(true);
  });
  it('does not contain ACTIVE or PENDING', () => {
    expect(NOT_WORKING_STATUSES.has('ACTIVE' as any)).toBe(false);
    expect(NOT_WORKING_STATUSES.has('PENDING' as any)).toBe(false);
  });
});

describe('resolveStatusOnDate', () => {
  const history = [
    mkRow('ACTIVE', '2026-01-01'),
    mkRow('INACTIVE', '2026-02-15', 'ACTIVE'),
    mkRow('ACTIVE', '2026-04-01', 'INACTIVE'),
  ];

  it('returns null for dates before any history entry', () => {
    expect(resolveStatusOnDate(history, new Date('2025-12-31'))).toBeNull();
  });

  it('returns ACTIVE for dates between first and second entry', () => {
    expect(resolveStatusOnDate(history, new Date('2026-01-15'))).toBe('ACTIVE');
  });

  it('returns INACTIVE for dates between second and third entry', () => {
    expect(resolveStatusOnDate(history, new Date('2026-03-15'))).toBe('INACTIVE');
  });

  it('returns ACTIVE for dates after the final entry', () => {
    expect(resolveStatusOnDate(history, new Date('2026-06-01'))).toBe('ACTIVE');
  });

  it('treats the changedAt boundary inclusively (status on the day-of equals the new status)', () => {
    expect(resolveStatusOnDate(history, new Date('2026-02-15'))).toBe('INACTIVE');
  });

  it('returns null for empty history', () => {
    expect(resolveStatusOnDate([], new Date('2026-01-01'))).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/services/__tests__/user-status-history.test.ts`
Expected: FAIL — `resolveStatusOnDate`/`NOT_WORKING_STATUSES` not exported yet.

- [ ] **Step 3: Implement the service**

Create `src/lib/services/user-status-history.ts`:

```ts
import { prisma } from '@/lib/prisma';
import { UserStatus, type UserStatusHistory } from '@prisma/client';
import { eachDayOfInterval, format } from 'date-fns';

export const NOT_WORKING_STATUSES: ReadonlySet<UserStatus> = new Set<UserStatus>([
  UserStatus.INACTIVE,
  UserStatus.PARTIAL_INACTIVE,
]);

/**
 * Resolve the effective UserStatus on a given date by walking sorted history.
 * Returns null if the date predates the earliest history entry.
 *
 * `history` MUST be sorted ascending by `changedAt`.
 */
export function resolveStatusOnDate(
  history: UserStatusHistory[],
  date: Date,
): UserStatus | null {
  if (history.length === 0) return null;
  let effective: UserStatus | null = null;
  for (const row of history) {
    if (row.changedAt.getTime() <= date.getTime()) {
      effective = row.toStatus;
    } else {
      break;
    }
  }
  return effective;
}

/**
 * Return the set of date keys ("yyyy-MM-dd") within [startDate, endDate]
 * during which the user was in a NOT_WORKING_STATUSES status.
 *
 * Returns an empty Set when no history exists (defensive for pre-backfill users).
 */
export async function getInactiveDateKeysInRange(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<Set<string>> {
  const history = await prisma.userStatusHistory.findMany({
    where: { userId, changedAt: { lte: endDate } },
    orderBy: { changedAt: 'asc' },
  });

  const keys = new Set<string>();
  if (history.length === 0) return keys;

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  for (const day of days) {
    const status = resolveStatusOnDate(history, day);
    if (status !== null && NOT_WORKING_STATUSES.has(status)) {
      keys.add(format(day, 'yyyy-MM-dd'));
    }
  }
  return keys;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/services/__tests__/user-status-history.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Full test suite**

Run: `npx vitest run`
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/user-status-history.ts src/lib/services/__tests__/user-status-history.test.ts
git commit -m "feat(status-history): add resolveStatusOnDate + getInactiveDateKeysInRange"
```

---

## Task 3: Backfill script

**Files:**
- Create: `scripts/backfill-user-status-history.ts`

- [ ] **Step 1: Write the script**

Create `scripts/backfill-user-status-history.ts`:

```ts
import { PrismaClient, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, status: true, createdAt: true, updatedAt: true },
  });

  let seeded = 0;
  let skipped = 0;

  for (const user of users) {
    const existing = await prisma.userStatusHistory.count({ where: { userId: user.id } });
    if (existing > 0) {
      skipped++;
      continue;
    }

    // Always insert an initial-state row at user.createdAt assuming ACTIVE.
    await prisma.userStatusHistory.create({
      data: {
        userId: user.id,
        fromStatus: null,
        toStatus: UserStatus.ACTIVE,
        changedAt: user.createdAt,
        reason: 'backfill: initial state',
      },
    });

    // If current status isn't ACTIVE, insert a transition row at updatedAt.
    if (user.status !== UserStatus.ACTIVE && user.updatedAt > user.createdAt) {
      await prisma.userStatusHistory.create({
        data: {
          userId: user.id,
          fromStatus: UserStatus.ACTIVE,
          toStatus: user.status,
          changedAt: user.updatedAt,
          reason: 'backfill: current state from updatedAt',
        },
      });
    }
    seeded++;
  }

  console.log(`Backfill complete. Seeded ${seeded} user(s). Skipped ${skipped} (already had history).`);
  console.log('Note: history granularity is limited for users with multiple past transitions.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run the script against local DB**

```bash
npx tsx scripts/backfill-user-status-history.ts
```

Expected: prints `Seeded N user(s). Skipped 0`. Run a second time to confirm idempotency: should print `Seeded 0. Skipped N`.

- [ ] **Step 3: Sanity-check DB rows**

```bash
npx prisma studio
```

Open `user_status_history` table. Spot-check: every user has at least one row. Users with non-ACTIVE status have two rows.

Or via SQL one-liner:
```bash
npx prisma db execute --stdin <<'SQL'
SELECT u.status, COUNT(h.*)
FROM users1 u
LEFT JOIN user_status_history h ON h.user_id = u.id
GROUP BY u.status;
SQL
```

Expected: every status group has a positive count.

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-user-status-history.ts
git commit -m "feat(scripts): backfill UserStatusHistory from createdAt/updatedAt"
```

---

## Task 4: Wire `update-status/route.ts` to write history + activity log

**Files:**
- Modify: `src/app/api/users/update-status/route.ts`

- [ ] **Step 1: Add the imports**

Already imports `ActivityType` and `logEntityActivity`. Add nothing new — just reuse them.

- [ ] **Step 2: Refactor to capture old status before update**

Around line 100, where `prisma.user.update(...)` is called, change the flow:

```ts
// Fetch the user's current status before updating.
const existingUser = await prisma.user.findUnique({
  where: { id: userId },
  select: { status: true },
});
if (!existingUser) {
  return NextResponse.json({ error: 'User not found' }, { status: 404 });
}
const oldStatus = existingUser.status;

// Update + write history + log activity in a single transaction.
const updatedUser = await prisma.$transaction(async (tx) => {
  const u = await tx.user.update({
    where: { id: userId },
    data: { status: status as UserStatus, updatedAt: new Date() },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      branch: { select: { id: true, name: true } },
    },
  });

  await tx.userStatusHistory.create({
    data: {
      userId,
      fromStatus: oldStatus,
      toStatus: status as UserStatus,
      changedById: currentUser.id,
      reason: null,
    },
  });

  return u;
});

// Log activity outside the transaction (it has its own error handling).
await logEntityActivity(
  ActivityType.USER_STATUS_CHANGED,
  currentUser.id,
  'User',
  userId,
  `Status changed from ${oldStatus} to ${status}`,
  { fromStatus: oldStatus, toStatus: status },
  request,
);
```

The existing referral-archive code block (above the update) stays unchanged.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 0 new errors, all tests pass.

- [ ] **Step 4: Manual smoke**

In the dev app: change a test user's status (HR → Users → toggle status). Check via Prisma Studio that:
- a new `user_status_history` row was inserted with correct `fromStatus`/`toStatus`/`changedById`
- a new `ActivityLog` row was inserted with type `USER_STATUS_CHANGED`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/users/update-status/route.ts
git commit -m "feat(users): record status transitions to history + activity log"
```

---

## Task 5: Wire `approve/route.ts` to write history

**Files:**
- Modify: `src/app/api/users/approve/route.ts`

- [ ] **Step 1: Locate the approve flow**

`grep -n "USER_STATUS_CHANGED\|prisma.user.update" src/app/api/users/approve/route.ts` to find the existing activity-log call and the user update.

- [ ] **Step 2: Add the history insert in the same transaction (or alongside the existing update)**

The approve route transitions a user from `PENDING` to `ACTIVE` (or similar). Capture the old status, wrap the user update in `prisma.$transaction`, and insert a `userStatusHistory.create` call with `fromStatus`/`toStatus`/`changedById`. Same pattern as Task 4.

If the existing code already runs inside a `prisma.$transaction`, simply add the history insert inside that block.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 0 new errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/users/approve/route.ts
git commit -m "feat(users): record approve transition to status history"
```

---

## Task 6: Wire the calendar read path

**Files:**
- Modify: `src/app/(auth)/attendance/[userId]/page.tsx`
- Modify: `src/components/attendance/detailed-attendance-calendar.tsx`

- [ ] **Step 1: Fetch inactive-day set on the server page**

In `src/app/(auth)/attendance/[userId]/page.tsx`, after the existing `prisma.attendance.findMany` call (around line 118-136), add:

```ts
import { getInactiveDateKeysInRange } from '@/lib/services/user-status-history';

// ... inside the page component, after attendance/salary fetches:
const inactiveDateKeys = await getInactiveDateKeysInRange(userId, startDate, endDate);
```

Pass it down to `<DetailedAttendanceCalendar>`:

```tsx
<DetailedAttendanceCalendar
  attendance={attendance}
  month={startDate}
  userId={employee.id}
  userName={employee.name || ""}
  userNumId={employee.numId}
  userImage={employee.image}
  userRole={role}
  department={employee.department?.name || ''}
  inactiveDateKeys={Array.from(inactiveDateKeys)}
/>
```

(We pass an array — `Set<string>` is not serialisable across the server/client boundary in Next.js. The component will rebuild the Set on the client.)

- [ ] **Step 2: Update the calendar component**

In `src/components/attendance/detailed-attendance-calendar.tsx`:

Add the prop:
```ts
interface DetailedAttendanceCalendarProps {
  attendance: Attendance[];
  month: Date;
  userId: string;
  userName: string;
  userNumId?: number | null;
  userImage?: string | null;
  userRole: string;
  department: string;
  inactiveDateKeys?: string[];
}
```

Rebuild the Set inside the component:
```ts
const inactiveSet = useMemo(
  () => new Set(inactiveDateKeys ?? []),
  [inactiveDateKeys],
);
```

Add `INACTIVE` to `getAttendanceStatus`. The inactive check runs FIRST, before the `!record` check:

```ts
const getAttendanceStatus = (date: Date) => {
  const dateKey = format(date, "yyyy-MM-dd");
  if (inactiveSet.has(dateKey)) return "INACTIVE";
  const record = attendanceMap.get(dateKey);
  if (!record) return "PENDING";
  if (record.status === "PENDING_VERIFICATION") {
    return record.isPresent ? "PENDING_PRESENT" : "PENDING_ABSENT";
  }
  if (!record.isPresent) return "ABSENT";
  if (record.isWeeklyOff) return "WEEKLY_OFF";
  if (record.isWorkFromHome) return "WORK_FROM_HOME";
  if (record.isHalfDay) return "HALF_DAY";
  return "PRESENT";
};
```

Add to `statusColors`:
```ts
INACTIVE: "bg-gray-100 text-gray-400",
```

Make INACTIVE days non-clickable. In `handleDateClick`, add an early-return:
```ts
const dateKey = format(date, "yyyy-MM-dd");
if (inactiveSet.has(dateKey)) return;
```

If there's a legend or tooltip rendering somewhere in the file, add a row for `INACTIVE` so the UX is self-explanatory.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 0 new errors, all tests pass.

- [ ] **Step 4: Manual smoke**

In the dev app:
1. Pick a test user. Mark them `INACTIVE` (or `PARTIAL_INACTIVE`).
2. Visit their attendance page (`/attendance/<userId>`). All days from the inactivation moment onwards should now show grey INACTIVE instead of yellow PENDING. Clicking an inactive tile should do nothing.
3. Mark them back to `ACTIVE`. The inactive window persists (correct). Future days remain PENDING/colored normally based on attendance records.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/attendance/\[userId\]/page.tsx src/components/attendance/detailed-attendance-calendar.tsx
git commit -m "feat(attendance): render inactive-period days as INACTIVE on calendar"
```

---

## Task 7: Final verification + open PR

- [ ] **Step 1: Full test suite**

```bash
npx vitest run
```

Expected: every test passes.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors (pre-existing `TS2578` unrelated).

- [ ] **Step 3: Production build**

```bash
npm run build
```

Expected: compiles successfully, generates static pages.

- [ ] **Step 4: Push + PR**

```bash
git push -u origin feature/user-status-history
gh pr create --title "feat: track user status history, fix reactivated-user attendance calendar" --body "$(cat <<'EOF'
## Summary
- Adds `UserStatusHistory` table (append-only audit + queryable).
- Records every status transition from `update-status` and `approve` routes, plus a `USER_STATUS_CHANGED` activity log entry (closes a pre-existing audit gap).
- Per-user attendance calendar now renders inactive-period days as neutral grey INACTIVE instead of yellow PENDING.
- Backfill script seeds best-effort initial history rows for every existing user.

## Out of scope
Salary calculations, monthly reports, and other date-range views. These can adopt the new `getInactiveDateKeysInRange` helper incrementally.

## Test plan
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes (new tests for `resolveStatusOnDate`)
- [ ] `npx tsc --noEmit` clean
- [ ] Manual: toggle a test user INACTIVE / PARTIAL_INACTIVE and verify their attendance calendar shows grey INACTIVE tiles for the inactive window; reactivate and verify post-reactivation days resume their normal coloring
- [ ] DB inspection: every status change writes one row to `user_status_history` and one to `ActivityLog`

Spec: `docs/superpowers/specs/2026-05-21-user-status-history-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review (already applied)

- **Spec coverage:** ✓ Every spec section maps to a task. Schema (T1), helper + tests (T2), backfill (T3), write paths (T4, T5), read path (T6), verify + PR (T7).
- **Placeholder scan:** ✓ No TBD/TODO. Every code step shows the exact code or a concrete pattern.
- **Type consistency:** ✓ `UserStatusHistory` shape matches between schema, helper signature, write callsites, and read callsite. `NOT_WORKING_STATUSES` is defined once and referenced from both spec and code.
- **Realism check:** ✓ Vitest is node-only; the helper is pure + DB-mockable. Calendar gets a manual smoke pass since the repo has no jsdom setup.
