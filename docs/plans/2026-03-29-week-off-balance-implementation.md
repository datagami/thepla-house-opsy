# Week Off Balance & Encashment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a ledger-based week-off credit/debit system that tracks weekly off usage, enforces balance limits at attendance creation, and optionally encashes unused week-offs at salary time.

**Architecture:** A new `WeekOffCredit` ledger table records all credits (Sunday cron grants) and debits (week-off taken, encashment). Balance is always derived via `SUM(amount)`, never cached. Attendance APIs check balance before allowing week-offs. Salary calculator reads the ledger to compute "Week Off Adjustment" payouts.

**Tech Stack:** Next.js 15, Prisma ORM (PostgreSQL), TypeScript, pdf-lib (payslips). No test framework is currently set up — we'll add Vitest.

---

### Task 1: Set up Vitest test framework

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add vitest + test script)

**Step 1: Install Vitest**

Run: `npm install --save-dev vitest`
Expected: vitest added to devDependencies

**Step 2: Create vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Step 3: Add test script to package.json**

Add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 4: Verify setup**

Run: `npx vitest run`
Expected: "No test files found" (confirms vitest works)

**Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add Vitest test framework"
```

---

### Task 2: Prisma schema changes

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/models/models.ts`

**Step 1: Add WeekOffCredit model to schema.prisma**

Add after the `ActivityLog` model (before the Job Offer section):

```prisma
// --- Week Off Credit Ledger ---

model WeekOffCredit {
  id           String   @id @default(cuid())
  numId        Int      @default(autoincrement()) @map("num_id")
  userId       String   @map("user_id")
  date         DateTime
  type         String   // CREDIT or DEBIT
  reason       String   // WEEKLY_GRANT, WEEK_OFF_TAKEN, ENCASHMENT, MANUAL_ADJUSTMENT, DELETION_REVERSAL
  amount       Float    // +1, -1, -0.5, etc.
  attendanceId String?  @map("attendance_id")
  salaryId     String?  @map("salary_id")
  createdBy    String?  @map("created_by")
  createdAt    DateTime @default(now()) @map("created_at")

  // Relations
  user       User        @relation("UserWeekOffCredits", fields: [userId], references: [id], onDelete: Cascade)
  attendance Attendance? @relation(fields: [attendanceId], references: [id], onDelete: SetNull)
  salary     Salary?     @relation("SalaryWeekOffCredits", fields: [salaryId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([userId, date])
  @@index([userId, type])
  @@index([attendanceId])
  @@index([salaryId])
  @@map("week_off_credits")
}
```

**Step 2: Add `encashWeekOffs` field to User model**

Add after the `weeklyOffDay` field (line ~150 area):

```prisma
  encashWeekOffs      Boolean  @default(true) @map("encash_week_offs")
```

**Step 3: Add relation to User model**

Add in the User relations section:

```prisma
  weekOffCredits     WeekOffCredit[] @relation("UserWeekOffCredits")
```

**Step 4: Add new fields to Salary model**

Add after the `leaveSalary` field:

```prisma
  weeklyOffDays    Int   @default(0) @map("weekly_off_days")
  unusedWeekOffs   Int   @default(0) @map("unused_week_offs")
  weekOffAdjustment Float @default(0) @map("week_off_adjustment")
```

**Step 5: Add relation to Salary model**

Add in the Salary relations section:

```prisma
  weekOffCredits   WeekOffCredit[] @relation("SalaryWeekOffCredits")
```

**Step 6: Add relation to Attendance model**

Add in the Attendance relations section:

```prisma
  weekOffCredits   WeekOffCredit[]
```

**Step 7: Update TypeScript interfaces in `src/models/models.ts`**

Add to Salary interface after `leaveSalary`:
```ts
  weeklyOffDays: number;
  unusedWeekOffs: number;
  weekOffAdjustment: number;
```

Add to User interface:
```ts
  encashWeekOffs: boolean;
  weekOffCredits?: WeekOffCredit[];
```

Add new interface:
```ts
export interface WeekOffCredit {
  id: string;
  numId: number;
  userId: string;
  date: Date;
  type: string;
  reason: string;
  amount: number;
  attendanceId?: string | null;
  salaryId?: string | null;
  createdBy?: string | null;
  createdAt: Date;
  user?: User;
  attendance?: Attendance | null;
  salary?: Salary | null;
}
```

**Step 8: Generate and run migration**

Run: `npx prisma migrate dev --name add-week-off-credit-ledger`
Expected: Migration created and applied successfully

**Step 9: Verify Prisma client generation**

Run: `npx prisma generate`
Expected: Prisma client generated successfully

**Step 10: Commit**

```bash
git add prisma/ src/models/models.ts
git commit -m "feat: add WeekOffCredit ledger model, User.encashWeekOffs, Salary week-off fields"
```

---

### Task 3: Week-off balance service

**Files:**
- Create: `src/lib/services/week-off-balance.ts`
- Create: `src/lib/services/__tests__/week-off-balance.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/services/__tests__/week-off-balance.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    weekOffCredit: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import {
  getWeekOffBalance,
  getMonthlyWeekOffSummary,
  createWeekOffCredit,
  checkWeekOffAvailability,
} from '../week-off-balance'

const mockedPrisma = vi.mocked(prisma)

describe('getWeekOffBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns sum of all credits and debits for a user', async () => {
    mockedPrisma.weekOffCredit.aggregate.mockResolvedValue({
      _sum: { amount: 3 },
      _count: { amount: 0 },
      _avg: { amount: 0 },
      _min: { amount: 0 },
      _max: { amount: 0 },
    } as any)

    const balance = await getWeekOffBalance('user-1')
    expect(balance).toBe(3)
    expect(mockedPrisma.weekOffCredit.aggregate).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      _sum: { amount: true },
    })
  })

  it('returns 0 when no credits exist', async () => {
    mockedPrisma.weekOffCredit.aggregate.mockResolvedValue({
      _sum: { amount: null },
      _count: { amount: 0 },
      _avg: { amount: 0 },
      _min: { amount: 0 },
      _max: { amount: 0 },
    } as any)

    const balance = await getWeekOffBalance('user-1')
    expect(balance).toBe(0)
  })
})

describe('getMonthlyWeekOffSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns credits and debits for a given month', async () => {
    mockedPrisma.weekOffCredit.findMany.mockResolvedValue([
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
    ] as any)

    const summary = await getMonthlyWeekOffSummary('user-1', 3, 2026)
    expect(summary.creditsThisMonth).toBe(4)
    expect(summary.debitsThisMonth).toBe(3)
    expect(summary.unusedThisMonth).toBe(1)
  })

  it('handles 5-week month with all credits used', async () => {
    mockedPrisma.weekOffCredit.findMany.mockResolvedValue([
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
    ] as any)

    const summary = await getMonthlyWeekOffSummary('user-1', 3, 2026)
    expect(summary.creditsThisMonth).toBe(5)
    expect(summary.debitsThisMonth).toBe(5)
    expect(summary.unusedThisMonth).toBe(0)
  })

  it('handles half-day debit', async () => {
    mockedPrisma.weekOffCredit.findMany.mockResolvedValue([
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -0.5 },
    ] as any)

    const summary = await getMonthlyWeekOffSummary('user-1', 3, 2026)
    expect(summary.creditsThisMonth).toBe(1)
    expect(summary.debitsThisMonth).toBe(0.5)
    expect(summary.unusedThisMonth).toBe(0.5)
  })

  it('excludes encashment debits from monthly usage count', async () => {
    mockedPrisma.weekOffCredit.findMany.mockResolvedValue([
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'ENCASHMENT', amount: -1 },
    ] as any)

    const summary = await getMonthlyWeekOffSummary('user-1', 3, 2026)
    expect(summary.creditsThisMonth).toBe(2)
    expect(summary.debitsThisMonth).toBe(1) // only WEEK_OFF_TAKEN
    expect(summary.unusedThisMonth).toBe(1)
  })
})

describe('checkWeekOffAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns available when balance > 0', async () => {
    mockedPrisma.weekOffCredit.aggregate.mockResolvedValue({
      _sum: { amount: 2 },
      _count: { amount: 0 },
      _avg: { amount: 0 },
      _min: { amount: 0 },
      _max: { amount: 0 },
    } as any)

    const result = await checkWeekOffAvailability('user-1')
    expect(result.available).toBe(true)
    expect(result.balance).toBe(2)
  })

  it('returns unavailable when balance is 0', async () => {
    mockedPrisma.weekOffCredit.aggregate.mockResolvedValue({
      _sum: { amount: 0 },
      _count: { amount: 0 },
      _avg: { amount: 0 },
      _min: { amount: 0 },
      _max: { amount: 0 },
    } as any)

    const result = await checkWeekOffAvailability('user-1')
    expect(result.available).toBe(false)
    expect(result.balance).toBe(0)
  })

  it('returns unavailable when balance is negative', async () => {
    mockedPrisma.weekOffCredit.aggregate.mockResolvedValue({
      _sum: { amount: -1 },
      _count: { amount: 0 },
      _avg: { amount: 0 },
      _min: { amount: 0 },
      _max: { amount: 0 },
    } as any)

    const result = await checkWeekOffAvailability('user-1')
    expect(result.available).toBe(false)
    expect(result.balance).toBe(-1)
  })

  it('checks for half-day availability (balance >= 0.5)', async () => {
    mockedPrisma.weekOffCredit.aggregate.mockResolvedValue({
      _sum: { amount: 0.5 },
      _count: { amount: 0 },
      _avg: { amount: 0 },
      _min: { amount: 0 },
      _max: { amount: 0 },
    } as any)

    const result = await checkWeekOffAvailability('user-1', 0.5)
    expect(result.available).toBe(true)
  })
})

describe('createWeekOffCredit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a WEEKLY_GRANT credit entry', async () => {
    const date = new Date('2026-03-01')
    mockedPrisma.weekOffCredit.create.mockResolvedValue({
      id: 'credit-1',
      userId: 'user-1',
      date,
      type: 'CREDIT',
      reason: 'WEEKLY_GRANT',
      amount: 1,
    } as any)

    const result = await createWeekOffCredit({
      userId: 'user-1',
      date,
      type: 'CREDIT',
      reason: 'WEEKLY_GRANT',
      amount: 1,
    })

    expect(result.type).toBe('CREDIT')
    expect(result.amount).toBe(1)
  })

  it('creates a WEEK_OFF_TAKEN debit entry with attendanceId', async () => {
    const date = new Date('2026-03-10')
    mockedPrisma.weekOffCredit.create.mockResolvedValue({
      id: 'debit-1',
      userId: 'user-1',
      date,
      type: 'DEBIT',
      reason: 'WEEK_OFF_TAKEN',
      amount: -1,
      attendanceId: 'att-1',
    } as any)

    const result = await createWeekOffCredit({
      userId: 'user-1',
      date,
      type: 'DEBIT',
      reason: 'WEEK_OFF_TAKEN',
      amount: -1,
      attendanceId: 'att-1',
    })

    expect(result.type).toBe('DEBIT')
    expect(result.amount).toBe(-1)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/services/__tests__/week-off-balance.test.ts`
Expected: FAIL — module `../week-off-balance` not found

**Step 3: Write the implementation**

Create `src/lib/services/week-off-balance.ts`:

```ts
import { prisma } from '@/lib/prisma'

export type WeekOffCreditType = 'CREDIT' | 'DEBIT'
export type WeekOffCreditReason =
  | 'WEEKLY_GRANT'
  | 'WEEK_OFF_TAKEN'
  | 'ENCASHMENT'
  | 'MANUAL_ADJUSTMENT'
  | 'DELETION_REVERSAL'

interface CreateWeekOffCreditParams {
  userId: string
  date: Date
  type: WeekOffCreditType
  reason: WeekOffCreditReason
  amount: number
  attendanceId?: string
  salaryId?: string
  createdBy?: string
}

/**
 * Get the current week-off balance for a user.
 * Balance = SUM(amount) of all WeekOffCredit entries.
 */
export async function getWeekOffBalance(userId: string): Promise<number> {
  const result = await prisma.weekOffCredit.aggregate({
    where: { userId },
    _sum: { amount: true },
  })
  return result._sum.amount ?? 0
}

/**
 * Get monthly week-off summary: credits granted, week-offs taken, and unused count.
 * Excludes ENCASHMENT debits from "debits this month" since those aren't usage.
 */
export async function getMonthlyWeekOffSummary(
  userId: string,
  month: number,
  year: number
) {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59, 999)

  const entries = await prisma.weekOffCredit.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
  })

  const creditsThisMonth = entries
    .filter((e) => e.type === 'CREDIT')
    .reduce((sum, e) => sum + e.amount, 0)

  // Only count WEEK_OFF_TAKEN debits as "usage" (not ENCASHMENT)
  const debitsThisMonth = entries
    .filter((e) => e.type === 'DEBIT' && e.reason === 'WEEK_OFF_TAKEN')
    .reduce((sum, e) => sum + Math.abs(e.amount), 0)

  const unusedThisMonth = creditsThisMonth - debitsThisMonth

  return { creditsThisMonth, debitsThisMonth, unusedThisMonth }
}

/**
 * Check if a user has enough week-off balance to take a day off.
 * @param requiredAmount - defaults to 1, use 0.5 for half-day
 */
export async function checkWeekOffAvailability(
  userId: string,
  requiredAmount: number = 1
): Promise<{ available: boolean; balance: number }> {
  const balance = await getWeekOffBalance(userId)
  return {
    available: balance >= requiredAmount,
    balance,
  }
}

/**
 * Create a week-off credit/debit ledger entry.
 */
export async function createWeekOffCredit(params: CreateWeekOffCreditParams) {
  return prisma.weekOffCredit.create({
    data: {
      userId: params.userId,
      date: params.date,
      type: params.type,
      reason: params.reason,
      amount: params.amount,
      attendanceId: params.attendanceId,
      salaryId: params.salaryId,
      createdBy: params.createdBy,
    },
  })
}

/**
 * Check if a WEEKLY_GRANT credit already exists for a user on a given date.
 * Used for idempotent cron execution.
 */
export async function hasWeeklyGrantForDate(
  userId: string,
  date: Date
): Promise<boolean> {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const existing = await prisma.weekOffCredit.findFirst({
    where: {
      userId,
      date: { gte: startOfDay, lte: endOfDay },
      type: 'CREDIT',
      reason: 'WEEKLY_GRANT',
    },
  })

  return !!existing
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/services/__tests__/week-off-balance.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/services/week-off-balance.ts src/lib/services/__tests__/week-off-balance.test.ts
git commit -m "feat: add week-off balance service with ledger queries"
```

---

### Task 4: Sunday cron job for weekly credits

**Files:**
- Create: `src/app/api/cron/weekly-off-credit/route.ts`

**Step 1: Create the cron endpoint**

Create `src/app/api/cron/weekly-off-credit/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createWeekOffCredit, hasWeeklyGrantForDate } from '@/lib/services/week-off-balance'

/**
 * Cron job endpoint for crediting weekly off balance every Sunday.
 * For all ACTIVE users with hasWeeklyOff = true, adds +1 WEEKLY_GRANT.
 * Idempotent: skips users who already have a grant for today.
 *
 * Recommended schedule: Every Sunday at 1:00 AM (0 1 * * 0)
 * Security: Protected by CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const timestamp = new Date().toISOString()
  const istTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })

  // Security: Verify the request is from an authorized source
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid or missing CRON_SECRET', timestamp },
      { status: 401 }
    )
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get all active users with weekly off enabled, joined on or before today
    const users = await prisma.user.findMany({
      where: {
        hasWeeklyOff: true,
        status: 'ACTIVE',
        createdAt: { lte: today },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    let credited = 0
    let skipped = 0
    const creditedUsers: Array<{ id: string; name: string | null }> = []

    for (const user of users) {
      // Idempotent: check if grant already exists for today
      const alreadyGranted = await hasWeeklyGrantForDate(user.id, today)
      if (alreadyGranted) {
        skipped++
        continue
      }

      await createWeekOffCredit({
        userId: user.id,
        date: today,
        type: 'CREDIT',
        reason: 'WEEKLY_GRANT',
        amount: 1,
        createdBy: 'system:weekly-off-credit-cron',
      })

      credited++
      creditedUsers.push({ id: user.id, name: user.name })
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: `Credited ${credited} users, skipped ${skipped}`,
      credited,
      skipped,
      totalEligible: users.length,
      duration: `${duration}ms`,
      timestamp,
      istTime,
      creditedUsers,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error('Weekly off credit cron error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to credit weekly off balance',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
        istTime,
        duration: `${duration}ms`,
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
```

**Step 2: Commit**

```bash
git add src/app/api/cron/weekly-off-credit/route.ts
git commit -m "feat: add Sunday cron job for weekly off credit grants"
```

---

### Task 5: Attendance POST — balance check + debit on week-off

**Files:**
- Modify: `src/app/api/attendance/route.ts:134-189` (POST handler, weekly off section)

**Step 1: Add imports at the top of `src/app/api/attendance/route.ts`**

Add after existing imports:

```ts
import { checkWeekOffAvailability, createWeekOffCredit } from '@/lib/services/week-off-balance'
```

**Step 2: Add balance check after flexible weekly off validation**

In the POST handler, find the section where `isWeeklyOff` is validated (around lines 145-189). After the existing flexible weekly off validation (the `if (existingWeeklyOff)` block that returns 400), and BEFORE the `if (isWeeklyOff) { data.isPresent = true; ... }` block, add:

```ts
      // Check week-off balance before allowing weekly off
      if (isWeeklyOff) {
        const { available, balance } = await checkWeekOffAvailability(data.userId)
        if (!available) {
          return NextResponse.json(
            {
              error: 'No week-off balance available. Employee must be marked as present or absent.',
              currentBalance: balance,
            },
            { status: 400 }
          )
        }
      }
```

**Step 3: Create debit entry after attendance is created**

After the attendance create call (around line 222: `const attendance = await prisma.attendance.create({...})`), and before the salary recalculation block, add:

```ts
    // Create week-off debit in ledger
    if (isWeeklyOff && attendance) {
      await createWeekOffCredit({
        userId: data.userId,
        date: attendanceDate,
        type: 'DEBIT',
        reason: 'WEEK_OFF_TAKEN',
        amount: -1,
        attendanceId: attendance.id,
        createdBy: creatorId,
      })
    }
```

**Step 4: Commit**

```bash
git add src/app/api/attendance/route.ts
git commit -m "feat: enforce week-off balance check and create debit on attendance POST"
```

---

### Task 6: Attendance PUT — HR override for fixed users + balance check

**Files:**
- Modify: `src/app/api/attendance/[id]/route.ts:306-371` (PUT handler, weekly off section)

**Step 1: Add imports**

Add at the top:

```ts
import { checkWeekOffAvailability, createWeekOffCredit } from '@/lib/services/week-off-balance'
```

**Step 2: Modify fixed weekly off auto-detection to allow override**

In the PUT handler, find the fixed weekly off section (around lines 320-323):

```ts
      if (userWithWeeklyOff.weeklyOffType === "FIXED") {
        // For fixed weekly off, check if the date matches the weekly off day
        const dayOfWeek = updateDate.getDay();
        isWeeklyOff = userWithWeeklyOff.weeklyOffDay === dayOfWeek;
      }
```

Replace with:

```ts
      if (userWithWeeklyOff.weeklyOffType === "FIXED") {
        const dayOfWeek = updateDate.getDay();
        const isOffDay = userWithWeeklyOff.weeklyOffDay === dayOfWeek;
        // Allow HR/Management to override: if they explicitly set isWeeklyOff to false
        // on the employee's off day, respect it (employee worked that day)
        if (isOffDay && body.isWeeklyOff === false) {
          isWeeklyOff = false; // HR override: employee worked on off day
        } else {
          isWeeklyOff = isOffDay;
        }
      }
```

**Step 3: Add balance check before allowing week-off (same pattern as POST)**

After the flexible weekly off validation block and before the `if (isWeeklyOff) { body.isPresent = true; ... }` block, add:

```ts
      // Check week-off balance before allowing weekly off
      if (isWeeklyOff) {
        const { available, balance } = await checkWeekOffAvailability(currentAttendance.userId)

        // If the current attendance was already a week-off, the balance already includes
        // the debit from the original creation, so we need to account for that
        const currentAttendanceRecord = await prisma.attendance.findUnique({
          where: { id },
          select: { isWeeklyOff: true },
        })
        const wasAlreadyWeeklyOff = currentAttendanceRecord?.isWeeklyOff ?? false
        const effectiveBalance = wasAlreadyWeeklyOff ? balance + 1 : balance

        if (effectiveBalance <= 0) {
          return NextResponse.json(
            {
              error: 'No week-off balance available. Employee must be marked as present or absent.',
              currentBalance: balance,
            },
            { status: 400 }
          )
        }
      }
```

**Step 4: Handle ledger entries for changed week-off status**

After the attendance update call, add logic to handle ledger changes:

```ts
    // Handle week-off ledger entries when isWeeklyOff status changes
    const previousAttendance = await prisma.attendance.findUnique({
      where: { id },
      select: { isWeeklyOff: true },
    })
    // Note: We need to check BEFORE the update. Since the update already happened,
    // we rely on comparing the new isWeeklyOff with what was there before.
    // This logic should be placed BEFORE the prisma.attendance.update call.
```

**Important implementation note:** The ledger entry logic needs to compare old vs new `isWeeklyOff`. Read the current attendance BEFORE the update, then after the update:
- If changing from `isWeeklyOff: false` → `isWeeklyOff: true`: create DEBIT (-1)
- If changing from `isWeeklyOff: true` → `isWeeklyOff: false`: create CREDIT (+1, reason: DELETION_REVERSAL)
- If no change: do nothing

Restructure the PUT handler to:
1. Read current attendance state (already done at line 182-194)
2. Perform all validations
3. Update the attendance
4. Compare old vs new `isWeeklyOff` and create ledger entries accordingly

```ts
    // After attendance update, handle ledger entries
    const wasWeeklyOff = currentAttendance.isWeeklyOff ?? false  // from the earlier query
    const isNowWeeklyOff = isWeeklyOff

    if (!wasWeeklyOff && isNowWeeklyOff) {
      // Changed to weekly off — create debit
      await createWeekOffCredit({
        userId: currentAttendance.userId,
        date: updateDate,
        type: 'DEBIT',
        reason: 'WEEK_OFF_TAKEN',
        amount: -1,
        attendanceId: id,
        createdBy: sessionUserId ?? undefined,
      })
    } else if (wasWeeklyOff && !isNowWeeklyOff) {
      // Changed from weekly off to working — return credit
      await createWeekOffCredit({
        userId: currentAttendance.userId,
        date: updateDate,
        type: 'CREDIT',
        reason: 'DELETION_REVERSAL',
        amount: 1,
        attendanceId: id,
        createdBy: sessionUserId ?? undefined,
      })
    }
```

**Note:** The `currentAttendance` query at line 182-194 needs to also select `isWeeklyOff`. Add it to the select:

```ts
    const currentAttendance = await prisma.attendance.findUnique({
      where: { id },
      select: {
        // ...existing fields...
        isWeeklyOff: true,  // ADD THIS
      }
    });
```

**Step 5: Commit**

```bash
git add src/app/api/attendance/[id]/route.ts
git commit -m "feat: allow HR override for fixed weekly off + balance check on PUT"
```

---

### Task 7: Attendance DELETE — return credit on week-off deletion

**Files:**
- Modify: `src/app/api/attendance/[id]/route.ts:447-542` (DELETE handler)

**Step 1: Add week-off credit reversal after attendance deletion**

After the `await prisma.attendance.delete(...)` call and before the salary recalculation, add:

```ts
    // If deleted attendance was a weekly off, return the credit
    if (attendance.isWeeklyOff) {
      await createWeekOffCredit({
        userId: attendance.userId,
        date: new Date(attendance.date),
        type: 'CREDIT',
        reason: 'DELETION_REVERSAL',
        amount: 1,
        attendanceId: id,
        createdBy: sessionUserId ?? undefined,
      })
    }
```

**Note:** The existing attendance query at line 459-465 needs to also select `isWeeklyOff`:

```ts
    const attendance = await prisma.attendance.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        date: true,
        isWeeklyOff: true,  // ADD THIS
      }
    });
```

**Step 2: Commit**

```bash
git add src/app/api/attendance/[id]/route.ts
git commit -m "feat: return week-off credit on attendance deletion"
```

---

### Task 8: Salary calculator — week-off adjustment + encashment

**Files:**
- Modify: `src/lib/services/salary-calculator.ts`
- Create: `src/lib/services/__tests__/salary-calculator.test.ts`

**Step 1: Write failing tests for salary calculator week-off logic**

Create `src/lib/services/__tests__/salary-calculator.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    attendance: { findMany: vi.fn() },
    advancePayment: { findMany: vi.fn() },
    weekOffCredit: {
      findMany: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { calculateSalary } from '../salary-calculator'

const mockedPrisma = vi.mocked(prisma)

describe('calculateSalary - week off adjustment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no advance payments
    mockedPrisma.advancePayment.findMany.mockResolvedValue([])
  })

  it('calculates weekOffAdjustment for encash user with unused week-offs', async () => {
    // March 2026: 31 days, 5 Sundays
    mockedPrisma.user.findUnique.mockResolvedValue({
      salary: 31000,
      hasWeeklyOff: true,
      encashWeekOffs: true,
      weeklyOffType: 'FLEXIBLE',
      weeklyOffDay: null,
    } as any)

    // 28 attendance records: 25 regular + 3 weekly off
    const regularDays = Array.from({ length: 25 }, (_, i) => ({
      isPresent: true, isWeeklyOff: false, isHalfDay: false, overtime: false,
      isWorkFromHome: false, status: 'APPROVED',
    }))
    const weeklyOffDays = Array.from({ length: 3 }, () => ({
      isPresent: true, isWeeklyOff: true, isHalfDay: false, overtime: false,
      isWorkFromHome: false, status: 'APPROVED',
    }))
    mockedPrisma.attendance.findMany.mockResolvedValue([...regularDays, ...weeklyOffDays] as any)

    // Ledger: 5 credits (5 Sundays), 3 debits (3 week-offs taken)
    mockedPrisma.weekOffCredit.findMany.mockResolvedValue([
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
    ] as any)

    const result = await calculateSalary('user-1', 3, 2026)

    // perDaySalary = 31000 / 31 = 1000
    // unused = 5 credits - 3 debits = 2
    // weekOffAdjustment = 2 * 1000 = 2000
    expect(result.weekOffAdjustment).toBe(2000)
    expect(result.unusedWeekOffs).toBe(2)
    expect(result.weeklyOffDays).toBe(3)
  })

  it('returns 0 weekOffAdjustment for non-encash user', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      salary: 31000,
      hasWeeklyOff: true,
      encashWeekOffs: false,
      weeklyOffType: 'FLEXIBLE',
      weeklyOffDay: null,
    } as any)

    mockedPrisma.attendance.findMany.mockResolvedValue([
      { isPresent: true, isWeeklyOff: true, isHalfDay: false, overtime: false, isWorkFromHome: false, status: 'APPROVED' },
    ] as any)

    mockedPrisma.weekOffCredit.findMany.mockResolvedValue([
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
    ] as any)

    const result = await calculateSalary('user-1', 3, 2026)
    expect(result.weekOffAdjustment).toBe(0)
    expect(result.unusedWeekOffs).toBe(1) // still tracked, just not paid
  })

  it('returns 0 weekOffAdjustment for user without weekly off', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      salary: 31000,
      hasWeeklyOff: false,
      encashWeekOffs: true,
    } as any)

    mockedPrisma.attendance.findMany.mockResolvedValue([
      { isPresent: true, isWeeklyOff: false, isHalfDay: false, overtime: false, isWorkFromHome: false, status: 'APPROVED' },
    ] as any)

    mockedPrisma.weekOffCredit.findMany.mockResolvedValue([])

    const result = await calculateSalary('user-1', 3, 2026)
    expect(result.weekOffAdjustment).toBe(0)
    expect(result.unusedWeekOffs).toBe(0)
  })

  it('handles 4-week month with all week-offs taken', async () => {
    // April 2026: 30 days
    mockedPrisma.user.findUnique.mockResolvedValue({
      salary: 30000,
      hasWeeklyOff: true,
      encashWeekOffs: true,
      weeklyOffType: 'FLEXIBLE',
      weeklyOffDay: null,
    } as any)

    const weeklyOffs = Array.from({ length: 4 }, () => ({
      isPresent: true, isWeeklyOff: true, isHalfDay: false, overtime: false,
      isWorkFromHome: false, status: 'APPROVED',
    }))
    mockedPrisma.attendance.findMany.mockResolvedValue(weeklyOffs as any)

    mockedPrisma.weekOffCredit.findMany.mockResolvedValue([
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
    ] as any)

    const result = await calculateSalary('user-1', 4, 2026)
    expect(result.weekOffAdjustment).toBe(0)
    expect(result.unusedWeekOffs).toBe(0)
  })

  it('handles half-day on off day for fixed user', async () => {
    // March 2026: 31 days
    mockedPrisma.user.findUnique.mockResolvedValue({
      salary: 31000,
      hasWeeklyOff: true,
      encashWeekOffs: true,
      weeklyOffType: 'FIXED',
      weeklyOffDay: 2, // Tuesday
    } as any)

    mockedPrisma.attendance.findMany.mockResolvedValue([
      // 4 normal weekly offs
      { isPresent: true, isWeeklyOff: true, isHalfDay: false, overtime: false, isWorkFromHome: false, status: 'APPROVED' },
      { isPresent: true, isWeeklyOff: true, isHalfDay: false, overtime: false, isWorkFromHome: false, status: 'APPROVED' },
      { isPresent: true, isWeeklyOff: true, isHalfDay: false, overtime: false, isWorkFromHome: false, status: 'APPROVED' },
      { isPresent: true, isWeeklyOff: true, isHalfDay: false, overtime: false, isWorkFromHome: false, status: 'APPROVED' },
    ] as any)

    mockedPrisma.weekOffCredit.findMany.mockResolvedValue([
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'CREDIT', reason: 'WEEKLY_GRANT', amount: 1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -1 },
      { type: 'DEBIT', reason: 'WEEK_OFF_TAKEN', amount: -0.5 }, // half day on off day
    ] as any)

    const result = await calculateSalary('user-1', 3, 2026)
    // 5 credits - 4.5 debits = 0.5 unused
    // weekOffAdjustment = 0.5 * 1000 = 500
    expect(result.weekOffAdjustment).toBe(500)
    expect(result.unusedWeekOffs).toBe(0.5)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/services/__tests__/salary-calculator.test.ts`
Expected: FAIL — `weekOffAdjustment` not in return value

**Step 3: Modify `src/lib/services/salary-calculator.ts`**

Add import at top:
```ts
import { getMonthlyWeekOffSummary } from '@/lib/services/week-off-balance'
```

Add to the `select` in the user query:
```ts
    select: {
      salary: true,
      hasWeeklyOff: true,
      encashWeekOffs: true,  // ADD
      weeklyOffType: true,   // ADD
      weeklyOffDay: true,    // ADD
    },
```

After the existing attendance counting loop (after line 66), add the week-off adjustment calculation:

```ts
  // Calculate week-off adjustment from ledger
  let unusedWeekOffs = 0
  let weekOffAdjustment = 0

  if (employee.hasWeeklyOff) {
    const summary = await getMonthlyWeekOffSummary(userId, month, year)
    unusedWeekOffs = summary.unusedThisMonth

    if (employee.encashWeekOffs && unusedWeekOffs > 0) {
      weekOffAdjustment = parseFloat((unusedWeekOffs * perDaySalary).toFixed(2))
    }
  }
```

Update the net salary calculation (around line 138):
```ts
  const netSalary = totalSalaryWithLeaves + weekOffAdjustment + otherBonuses - deductions;
```

Add new fields to the return object:
```ts
  return {
    // ...existing fields...
    weeklyOffDays,
    unusedWeekOffs,
    weekOffAdjustment,
  }
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/services/__tests__/salary-calculator.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/services/salary-calculator.ts src/lib/services/__tests__/salary-calculator.test.ts
git commit -m "feat: add week-off adjustment calculation to salary calculator"
```

---

### Task 9: Salary generation — save new fields + encashment debit

**Files:**
- Modify: `src/app/api/salary/generate/route.ts:143-196` (inside the transaction)

**Step 1: Import createWeekOffCredit**

Add at top:
```ts
import { createWeekOffCredit } from '@/lib/services/week-off-balance'
```

**Step 2: Save new fields in salary creation**

In the `tx.salary.create` data (around line 145-162), add after `leaveSalary`:

```ts
            weeklyOffDays: salaryDetails.weeklyOffDays,
            unusedWeekOffs: salaryDetails.unusedWeekOffs,
            weekOffAdjustment: salaryDetails.weekOffAdjustment,
```

**Step 3: Create encashment debit after salary creation**

After the salary creation (after `const salary = await tx.salary.create({...})`), add:

```ts
        // Create encashment debit in ledger for users with encash enabled
        if (salaryDetails.weekOffAdjustment > 0 && salaryDetails.unusedWeekOffs > 0) {
          await createWeekOffCredit({
            userId: user.id,
            date: new Date(year, month - 1, endDate.getDate()), // last day of month
            type: 'DEBIT',
            reason: 'ENCASHMENT',
            amount: -salaryDetails.unusedWeekOffs,
            salaryId: salary.id,
            createdBy: 'system:salary-generation',
          })
        }
```

**Step 4: Also update the net salary formula in PATCH handler**

The PATCH handler (status changes) recalculates net salary in several places. Find all instances where `netSalary` is computed and add `weekOffAdjustment`:

In the PROCESSING status change (around line 318):
```ts
            netSalary: existingSalary.baseSalary +
                      existingSalary.overtimeBonus +
                      existingSalary.weekOffAdjustment +  // ADD THIS
                      existingSalary.otherBonuses -
                      totalApprovedDeductions -
                      existingSalary.deductions
```

Do the same for all other netSalary recalculations in this file (there are ~4 instances).

**Step 5: Commit**

```bash
git add src/app/api/salary/generate/route.ts
git commit -m "feat: save week-off fields in salary generation + encashment debit"
```

---

### Task 10: Salary stats — include new fields

**Files:**
- Modify: `src/app/api/salary/[id]/stats/route.ts`

**Step 1: Add weekOffAdjustment to stats response**

In the stats object (around line 133-185), add to the `salary` section:

```ts
        weeklyOffDays: salary.weeklyOffDays,
        unusedWeekOffs: salary.unusedWeekOffs,
        weekOffAdjustment: salary.weekOffAdjustment,
```

And add `weekOffAdjustment` to the `baseSalaryEarned` calculation:
```ts
    const baseSalaryEarned = presentDaysSalary + overtimeSalary + salary.otherBonuses + leaveSalary + salary.weekOffAdjustment;
```

**Step 2: Commit**

```bash
git add src/app/api/salary/[id]/stats/route.ts
git commit -m "feat: include week-off adjustment in salary stats"
```

---

### Task 11: Payslip — conditional "Week Off Adjustment" line

**Files:**
- Modify: `src/app/api/salary/[id]/payslip/route.ts`

**Step 1: Add Week Off Adjustment to earnings section**

In the earnings array (around line 286-299), add BEFORE the "Other Bonuses" entries:

```ts
			// Week Off Adjustment — only show when > 0
			if (salary.weekOffAdjustment > 0) {
				earnings.push({ label: 'Week Off Adjustment', amount: salary.weekOffAdjustment });
			}
```

**Step 2: Update totalEarnings to include weekOffAdjustment**

Update the `baseSalaryEarned` calculation:
```ts
			const baseSalaryEarned = presentDaysSalary + overtimeSalary + salary.otherBonuses + leaveSalary + salary.weekOffAdjustment;
```

**Step 3: Commit**

```bash
git add src/app/api/salary/[id]/payslip/route.ts
git commit -m "feat: show Week Off Adjustment on payslip when applicable"
```

---

### Task 12: Fix all netSalary recalculation sites

**Files:**
- Modify: `src/app/api/salary/generate/route.ts` (PATCH handler, ~4 locations)
- Modify: `src/lib/services/salary-calculator.ts:271-298` (`calculateNetSalaryFromObject`)

**Step 1: Update `calculateNetSalaryFromObject`**

In `src/lib/services/salary-calculator.ts`, update the function:

```ts
export function calculateNetSalaryFromObject(salary: Salary) {
  const daysInMonth = new Date(salary.year, salary.month, 0).getDate();
  const perDaySalary = Math.round((salary.baseSalary / daysInMonth) * 100) / 100;
  const presentDaysSalary = salary.presentDays * perDaySalary;
  const overtimeSalary = salary.overtimeDays * 0.5 * perDaySalary;
  const leaveSalary = salary.leavesEarned * perDaySalary;

  const baseSalaryEarned = presentDaysSalary + overtimeSalary + salary.otherBonuses + leaveSalary + salary.weekOffAdjustment;

  let totalAdvanceDeductions = 0;
  if (salary.installments) {
    totalAdvanceDeductions = salary.installments
      .filter(i => i.status === 'APPROVED')
      .reduce((sum, i) => sum + i.amountPaid, 0);
  }

  const totalDeductions = totalAdvanceDeductions + salary.otherDeductions;
  return Math.round(baseSalaryEarned - totalDeductions);
}
```

**Step 2: Audit all netSalary formulas in `salary/generate/route.ts`**

Search for all `netSalary:` assignments in the PATCH handler and add `+ existingSalary.weekOffAdjustment` (or equivalent) to each. There are approximately 4 locations that need updating.

**Step 3: Commit**

```bash
git add src/lib/services/salary-calculator.ts src/app/api/salary/generate/route.ts
git commit -m "fix: include weekOffAdjustment in all netSalary recalculation sites"
```

---

### Task 13: March 2026 backfill script

**Files:**
- Create: `scripts/backfill-march-week-off-credits.ts`

**Step 1: Create the backfill script**

Create `scripts/backfill-march-week-off-credits.ts`:

```ts
/**
 * Backfill script: Generate WeekOffCredit ledger entries for March 2026
 *
 * For each active user with hasWeeklyOff = true:
 * 1. Create WEEKLY_GRANT CREDIT entries for each Sunday in March
 *    (only Sundays on or after user's createdAt date)
 * 2. Create WEEK_OFF_TAKEN DEBIT entries for each isWeeklyOff attendance in March
 *
 * Usage: npx tsx scripts/backfill-march-week-off-credits.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const isDryRun = process.argv.includes('--dry-run')

  if (isDryRun) {
    console.log('=== DRY RUN MODE — no data will be written ===\n')
  }

  const year = 2026
  const month = 3 // March
  const startDate = new Date(year, month - 1, 1) // March 1
  const endDate = new Date(year, month, 0) // March 31

  // Find all Sundays in March 2026
  const sundays: Date[] = []
  const current = new Date(startDate)
  while (current <= endDate) {
    if (current.getDay() === 0) { // Sunday
      sundays.push(new Date(current))
    }
    current.setDate(current.getDate() + 1)
  }
  console.log(`Sundays in March ${year}: ${sundays.map(d => d.getDate()).join(', ')}`)
  console.log(`Total: ${sundays.length} Sundays\n`)

  // Get all users with weekly off
  const users = await prisma.user.findMany({
    where: {
      hasWeeklyOff: true,
      status: { in: ['ACTIVE', 'PARTIAL_INACTIVE'] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      weeklyOffType: true,
      weeklyOffDay: true,
    },
  })

  console.log(`Found ${users.length} users with weekly off\n`)

  let totalCredits = 0
  let totalDebits = 0

  for (const user of users) {
    console.log(`--- ${user.name || user.email || user.id} (${user.weeklyOffType}) ---`)

    // Check if entries already exist (idempotent)
    const existingCredits = await prisma.weekOffCredit.count({
      where: {
        userId: user.id,
        date: { gte: startDate, lte: endDate },
      },
    })

    if (existingCredits > 0) {
      console.log(`  SKIPPED: Already has ${existingCredits} ledger entries for March`)
      continue
    }

    // 1. Create WEEKLY_GRANT credits for eligible Sundays
    const userCreatedAt = new Date(user.createdAt)
    userCreatedAt.setHours(0, 0, 0, 0)

    const eligibleSundays = sundays.filter(s => s >= userCreatedAt)
    console.log(`  Credits: ${eligibleSundays.length} Sundays (joined ${user.createdAt.toISOString().split('T')[0]})`)

    if (!isDryRun) {
      for (const sunday of eligibleSundays) {
        await prisma.weekOffCredit.create({
          data: {
            userId: user.id,
            date: sunday,
            type: 'CREDIT',
            reason: 'WEEKLY_GRANT',
            amount: 1,
            createdBy: 'system:backfill-march-2026',
          },
        })
      }
    }
    totalCredits += eligibleSundays.length

    // 2. Create WEEK_OFF_TAKEN debits for existing weekly off attendance
    const weeklyOffAttendance = await prisma.attendance.findMany({
      where: {
        userId: user.id,
        date: { gte: startDate, lte: endDate },
        isWeeklyOff: true,
        status: 'APPROVED',
      },
      select: { id: true, date: true, isHalfDay: true },
    })

    console.log(`  Debits: ${weeklyOffAttendance.length} week-off days taken`)

    if (!isDryRun) {
      for (const att of weeklyOffAttendance) {
        const amount = att.isHalfDay ? -0.5 : -1
        await prisma.weekOffCredit.create({
          data: {
            userId: user.id,
            date: att.date,
            type: 'DEBIT',
            reason: 'WEEK_OFF_TAKEN',
            amount,
            attendanceId: att.id,
            createdBy: 'system:backfill-march-2026',
          },
        })
      }
    }
    totalDebits += weeklyOffAttendance.length

    const balance = eligibleSundays.length - weeklyOffAttendance.length
    console.log(`  Balance: ${balance}`)
    console.log('')
  }

  console.log('=== SUMMARY ===')
  console.log(`Total CREDIT entries: ${totalCredits}`)
  console.log(`Total DEBIT entries: ${totalDebits}`)
  console.log(`Net balance across all users: ${totalCredits - totalDebits}`)

  if (isDryRun) {
    console.log('\n=== DRY RUN — no data was written. Remove --dry-run to execute. ===')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**Step 2: Test with dry run**

Run: `npx tsx scripts/backfill-march-week-off-credits.ts --dry-run`
Expected: Lists all users and what would be created, without writing data

**Step 3: Commit**

```bash
git add scripts/backfill-march-week-off-credits.ts
git commit -m "feat: add March 2026 backfill script for week-off credits"
```

---

### Task 14: Run full test suite and verify build

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Verify the app builds**

Run: `npx prisma generate && npm run build`
Expected: Build succeeds with no TypeScript errors

**Step 3: Fix any build errors**

Address TypeScript errors, missing imports, or type mismatches found during build.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build errors for week-off balance feature"
```

---

### Task 15: UI — Employee week-off balance card (optional, can defer)

This task adds the simple "Available / Used this month" card to the employee dashboard. Since it requires identifying the correct dashboard component and understanding the frontend patterns, **this can be done as a follow-up after the backend is validated against prod data.**

**Files to identify:**
- The employee dashboard/attendance page component
- Create an API endpoint: `src/app/api/week-off-balance/route.ts` that returns `{ available: number, usedThisMonth: number }`

---

## Implementation Notes

- **Timezone awareness:** All date comparisons use `setHours(0,0,0,0)` to normalize. The cron job should run in IST context (matching existing crons).
- **Idempotency:** The Sunday cron checks for existing grants before creating. The backfill script checks for existing entries before writing.
- **No data migration risk:** All changes add new columns with defaults or create new tables. Existing data is untouched.
- **Encashment does NOT reset balance:** The encashment DEBIT is recorded in the ledger, which naturally reduces the running balance. But it's computed from monthly data, not from the running total.
