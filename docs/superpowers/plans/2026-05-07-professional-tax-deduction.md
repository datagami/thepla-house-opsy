# Professional Tax Deduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic Professional Tax (₹200/month, ₹300 in Feb) deduction for opted-in employees with base salary ≥ ₹10,000, plus per-employee opt-in flags for PT/PF/ESI with bulk Excel management.

**Architecture:** Three boolean opt-in flags on `User` (config) + a JSON array `recurringDeductions` snapshot on `Salary` (immutable record). PT logic lives in `salary-calculator.ts`. PF/ESI flags ship dormant for later. Bulk Excel UI follows the existing `user-data-import-export.tsx` pattern.

**Tech Stack:** Next.js 15 App Router, Prisma + PostgreSQL, TypeScript, `xlsx` package, `pdf-lib` for payslips, **`vitest` for unit tests** (added in this plan — codebase has no test framework today).

**Spec:** `docs/superpowers/specs/2026-05-07-professional-tax-deduction-design.md`

---

## File Structure

**Schema & migrations:**
- Modify: `prisma/schema.prisma` (User model + Salary model)
- Create: `prisma/migrations/20260507120000_add_recurring_deductions_and_optin_flags/migration.sql`

**Types:**
- Modify: `src/models/models.ts` (Salary + User interfaces)

**Calculator (pure logic):**
- Create: `src/lib/services/recurring-deductions.ts` (the pure helper + types)
- Create: `src/lib/services/salary-math.ts` (extracted pure net-salary math)
- Modify: `src/lib/services/salary-calculator.ts` (wire pure helpers in; remove math)

**Tests:**
- Create: `vitest.config.ts`
- Create: `src/lib/services/__tests__/recurring-deductions.test.ts`
- Create: `src/lib/services/__tests__/salary-math.test.ts`
- Modify: `package.json` (add `test` script + vitest devDep)

**Salary API routes touched:**
- Modify: `src/app/api/salary/[id]/payslip/route.ts`
- Modify: `src/app/api/salary/[id]/stats/route.ts`
- Modify: `src/app/api/salary/[id]/adjustment/route.ts`
- Modify: `src/app/api/salary/bulk-update-status/route.ts`
- Modify: `src/app/api/salary/generate/route.ts` (net salary recompute spots at lines 390 & 588)

**Per-user opt-in UI:**
- Modify: `src/components/users/user-profile-form.tsx`
- Modify: `src/app/api/users/[id]/route.ts` (or wherever PATCH/PUT lives)

**Bulk Excel page:**
- Create: `src/app/(auth)/users/deduction-settings/page.tsx`
- Create: `src/components/users/deduction-settings-page.tsx` (client component)
- Create: `src/app/api/users/deduction-settings/export/route.ts`
- Create: `src/app/api/users/deduction-settings/import/route.ts`

**Navigation:**
- Modify: navigation/sidebar source (located in Task 13 by grep)

---

## Task 1: Schema migration + Prisma types

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260507120000_add_recurring_deductions_and_optin_flags/migration.sql`

- [ ] **Step 1: Add three opt-in flags to User model**

In `prisma/schema.prisma`, find `model User {` and add these three lines next to the other booleans (e.g., near `hasWeeklyOff`):

```prisma
  // Statutory deduction opt-ins
  optInPT  Boolean @default(false) @map("opt_in_pt")
  optInPF  Boolean @default(false) @map("opt_in_pf")
  optInESI Boolean @default(false) @map("opt_in_esi")
```

- [ ] **Step 2: Add `recurringDeductions` JSON column to Salary model**

In `prisma/schema.prisma`, in `model Salary { … }`, add this line just below `otherDeductions`:

```prisma
  recurringDeductions Json?    @map("recurring_deductions")
```

- [ ] **Step 3: Create the migration file**

Run:

```bash
mkdir -p prisma/migrations/20260507120000_add_recurring_deductions_and_optin_flags
```

Create `prisma/migrations/20260507120000_add_recurring_deductions_and_optin_flags/migration.sql` with:

```sql
-- Per-employee statutory opt-in flags
ALTER TABLE "User"
  ADD COLUMN "opt_in_pt"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "opt_in_pf"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "opt_in_esi" BOOLEAN NOT NULL DEFAULT false;

-- Snapshot of recurring deductions applied to a salary (PT, PF, ESI, …)
-- Format: [{ "code": "PT", "name": "Professional Tax", "amount": 200 }, …]
ALTER TABLE "Salary"
  ADD COLUMN "recurring_deductions" JSONB;
```

Verify the table names match by checking how the existing schema generates them (Prisma uses model names by default unless `@@map` is set). Run:

```bash
grep -E '@@map\("(users|user|salaries|salary)"' prisma/schema.prisma
```

Expected: probably no `@@map` for User/Salary (they use the model names). If `@@map` is set, adjust the SQL table names to match.

- [ ] **Step 4: Apply the migration locally**

```bash
npx prisma migrate dev --name add_recurring_deductions_and_optin_flags
```

If the file already exists with that name, use:

```bash
npx prisma migrate resolve --applied 20260507120000_add_recurring_deductions_and_optin_flags
npx prisma generate
```

Expected: migration applied, Prisma Client regenerated.

- [ ] **Step 5: Verify in psql / Prisma Studio**

```bash
npx prisma studio
```

Open the User table → confirm `optInPT`, `optInPF`, `optInESI` columns exist (default `false`). Open Salary → confirm `recurringDeductions` exists (nullable JSON).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260507120000_add_recurring_deductions_and_optin_flags
git commit -m "feat(db): add opt-in flags and recurring deductions columns"
```

---

## Task 2: Update TS model interfaces

**Files:**
- Modify: `src/models/models.ts`

- [ ] **Step 1: Add the recurring deduction entry type**

At the top of `src/models/models.ts` (or near the existing `Salary` interface around line 283), add:

```ts
export interface RecurringDeductionEntry {
  code: string;       // "PT" | "PF" | "ESI" | …
  name: string;       // Human-readable
  amount: number;
}
```

- [ ] **Step 2: Add field to `Salary` interface**

In the existing `Salary` interface around line 283, add after `otherDeductions`:

```ts
  recurringDeductions?: RecurringDeductionEntry[] | null;
```

- [ ] **Step 3: Add fields to `User` interface**

Find the `User` interface (search for `export interface User`). Add:

```ts
  optInPT?: boolean;
  optInPF?: boolean;
  optInESI?: boolean;
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors. (Pre-existing errors are fine — note them, don't fix.)

- [ ] **Step 5: Commit**

```bash
git add src/models/models.ts
git commit -m "feat(types): add opt-in flags and RecurringDeductionEntry"
```

---

## Task 3: Set up vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

The codebase has no test framework today. We add vitest because it's the de-facto choice for Next.js + TS, supports path aliases (`@/...`) cleanly, and runs without DOM by default for pure-logic tests.

- [ ] **Step 1: Install vitest as a dev dependency**

```bash
npm install --save-dev vitest @vitest/coverage-v8
```

Expected: `package.json` updated, lockfile updated.

- [ ] **Step 2: Add a `test` script to `package.json`**

In `package.json` `"scripts"` block, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts` at the project root**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Smoke-test the runner with a placeholder**

Create `src/lib/services/__tests__/sanity.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run:

```bash
npm test
```

Expected: 1 test passes. Then delete the sanity test file.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore(test): add vitest with @ path alias"
```

---

## Task 4: Pure recurring-deductions helper + vitest tests

**Files:**
- Create: `src/lib/services/recurring-deductions.ts`
- Create: `src/lib/services/__tests__/recurring-deductions.test.ts`

This is the heart of the PT feature. Pure function, no DB, no side effects.

- [ ] **Step 1: Write the failing test**

Create `src/lib/services/__tests__/recurring-deductions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  computeRecurringDeductions,
  sumRecurringDeductions,
  type RecurringDeductionUserInput,
} from '@/lib/services/recurring-deductions'

function user(overrides: Partial<RecurringDeductionUserInput> = {}): RecurringDeductionUserInput {
  return { optInPT: false, optInPF: false, optInESI: false, salary: 15000, ...overrides }
}

describe('computeRecurringDeductions — Professional Tax', () => {
  it('applies PT ₹200 when opted in and salary >= 10000 (non-February)', () => {
    expect(computeRecurringDeductions(user({ optInPT: true, salary: 10000 }), 1))
      .toEqual([{ code: 'PT', name: 'Professional Tax', amount: 200 }])
  })

  it('applies PT ₹300 in February', () => {
    expect(computeRecurringDeductions(user({ optInPT: true, salary: 12000 }), 2))
      .toEqual([{ code: 'PT', name: 'Professional Tax', amount: 300 }])
  })

  it('does not apply PT when salary < 10000 even if opted in', () => {
    expect(computeRecurringDeductions(user({ optInPT: true, salary: 9999 }), 1)).toEqual([])
  })

  it('does not apply PT when not opted in regardless of salary', () => {
    expect(computeRecurringDeductions(user({ optInPT: false, salary: 50000 }), 1)).toEqual([])
  })

  it('does not apply PT when salary is null', () => {
    expect(computeRecurringDeductions(user({ optInPT: true, salary: null }), 1)).toEqual([])
  })

  it('treats threshold as inclusive (salary === 10000 → PT applies)', () => {
    const res = computeRecurringDeductions(user({ optInPT: true, salary: 10000 }), 6)
    expect(res).toHaveLength(1)
    expect(res[0].amount).toBe(200)
  })
})

describe('computeRecurringDeductions — PF/ESI dormant', () => {
  it('ignores PF and ESI flags entirely (no logic yet)', () => {
    expect(computeRecurringDeductions(
      user({ optInPF: true, optInESI: true, salary: 50000 }), 1,
    )).toEqual([])
  })
})

describe('sumRecurringDeductions', () => {
  it('returns 0 for null / undefined / empty', () => {
    expect(sumRecurringDeductions(null)).toBe(0)
    expect(sumRecurringDeductions(undefined)).toBe(0)
    expect(sumRecurringDeductions([])).toBe(0)
  })

  it('sums all entries', () => {
    expect(sumRecurringDeductions([
      { code: 'PT', name: 'PT', amount: 200 },
      { code: 'PF', name: 'PF', amount: 1800 },
    ])).toBe(2000)
  })
})
```

- [ ] **Step 2: Run the test, verify it fails (module not found)**

```bash
npm test
```

Expected: failure — `Cannot find module '@/lib/services/recurring-deductions'` or similar.

- [ ] **Step 3: Implement the helper**

Create `src/lib/services/recurring-deductions.ts`:

```ts
import type { RecurringDeductionEntry } from '@/models/models'

const PT_THRESHOLD_INCLUSIVE = 10000
const PT_AMOUNT_REGULAR = 200
const PT_AMOUNT_FEBRUARY = 300
const FEBRUARY = 2

export interface RecurringDeductionUserInput {
  optInPT: boolean
  optInPF: boolean
  optInESI: boolean
  salary: number | null
}

/**
 * Pure: decides which recurring deductions apply for a user in a given month.
 * PT applies iff optInPT && salary >= 10000. ₹300 in Feb, ₹200 otherwise. Flat (not pro-rated).
 * PF/ESI flags exist on the user but are intentionally ignored — logic ships later.
 */
export function computeRecurringDeductions(
  user: RecurringDeductionUserInput,
  month: number,
): RecurringDeductionEntry[] {
  const entries: RecurringDeductionEntry[] = []

  if (user.optInPT && user.salary !== null && user.salary >= PT_THRESHOLD_INCLUSIVE) {
    entries.push({
      code: 'PT',
      name: 'Professional Tax',
      amount: month === FEBRUARY ? PT_AMOUNT_FEBRUARY : PT_AMOUNT_REGULAR,
    })
  }

  return entries
}

export function sumRecurringDeductions(
  entries: RecurringDeductionEntry[] | null | undefined,
): number {
  if (!entries) return 0
  return entries.reduce((sum, e) => sum + e.amount, 0)
}
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
npm test
```

Expected: all `recurring-deductions` tests pass (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/recurring-deductions.ts src/lib/services/__tests__/recurring-deductions.test.ts
git commit -m "feat(salary): pure recurring-deductions helper with vitest coverage"
```

---

## Task 5: Extract pure salary-math helper + vitest tests

**Files:**
- Create: `src/lib/services/salary-math.ts`
- Create: `src/lib/services/__tests__/salary-math.test.ts`

The current `calculateSalary` in `salary-calculator.ts` mixes data-fetching and math. To test the math (especially the integration of PT into net salary), we extract the pure portion into its own module. This is a small, focused refactor that improves testability without disturbing the IO surface.

The pure helper takes everything as inputs and returns a breakdown.

- [ ] **Step 1: Write the failing test**

Create `src/lib/services/__tests__/salary-math.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeSalaryBreakdown, type SalaryMathInput } from '@/lib/services/salary-math'

function input(overrides: Partial<SalaryMathInput> = {}): SalaryMathInput {
  return {
    baseSalary: 30000,
    daysInMonth: 30,
    presentDays: 30,
    overtimeDays: 0,
    leavesEarned: 0,
    otherBonuses: 0,
    advanceTotal: 0,
    recurringDeductions: [],
    ...overrides,
  }
}

describe('computeSalaryBreakdown — base earnings', () => {
  it('full month, no extras → net == base salary (rounded)', () => {
    const r = computeSalaryBreakdown(input())
    expect(r.perDaySalary).toBe(1000)
    expect(r.presentDaysAmount).toBe(30000)
    expect(r.overtimeAmount).toBe(0)
    expect(r.leaveSalary).toBe(0)
    expect(r.netSalary).toBe(30000)
  })

  it('half-month attendance halves the earned amount', () => {
    const r = computeSalaryBreakdown(input({ presentDays: 15 }))
    expect(r.presentDaysAmount).toBe(15000)
    expect(r.netSalary).toBe(15000)
  })

  it('overtime adds half-day equivalent per overtime day on top of present-day pay', () => {
    // 20 regular + 5 overtime → presentDays = 25, overtimeDays = 5
    const r = computeSalaryBreakdown(input({ presentDays: 25, overtimeDays: 5 }))
    expect(r.presentDaysAmount).toBe(25000)        // 25 × 1000
    expect(r.overtimeAmount).toBe(2500)            // 5 × (1000 × 0.5)
    expect(r.netSalary).toBe(27500)
  })

  it('leavesEarned multiplies per-day salary into leaveSalary and adds to net', () => {
    const r = computeSalaryBreakdown(input({ presentDays: 28, leavesEarned: 2 }))
    expect(r.leaveSalary).toBe(2000)
    expect(r.netSalary).toBe(28000 + 2000)
  })
})

describe('computeSalaryBreakdown — deductions', () => {
  it('subtracts advance total', () => {
    const r = computeSalaryBreakdown(input({ advanceTotal: 5000 }))
    expect(r.netSalary).toBe(25000)
  })

  it('subtracts the sum of recurring deductions', () => {
    const r = computeSalaryBreakdown(input({
      recurringDeductions: [
        { code: 'PT', name: 'Professional Tax', amount: 200 },
      ],
    }))
    expect(r.recurringTotal).toBe(200)
    expect(r.netSalary).toBe(29800)
  })

  it('PT is flat — applies in full even when half-month attendance', () => {
    const r = computeSalaryBreakdown(input({
      presentDays: 15,
      recurringDeductions: [
        { code: 'PT', name: 'Professional Tax', amount: 200 },
      ],
    }))
    expect(r.presentDaysAmount).toBe(15000)
    expect(r.recurringTotal).toBe(200)
    expect(r.netSalary).toBe(14800)
  })

  it('stacks advances + recurring + bonuses correctly', () => {
    const r = computeSalaryBreakdown(input({
      presentDays: 30,
      otherBonuses: 1000,
      advanceTotal: 2000,
      recurringDeductions: [
        { code: 'PT', name: 'Professional Tax', amount: 300 },
      ],
    }))
    // 30000 + 0 ot + 0 leave + 1000 bonus - 2000 advance - 300 PT = 28700
    expect(r.netSalary).toBe(28700)
  })
})

describe('computeSalaryBreakdown — rounding & edge cases', () => {
  it('handles non-integer per-day salary correctly (29-day month, base 30000)', () => {
    const r = computeSalaryBreakdown(input({ daysInMonth: 29, presentDays: 29 }))
    // 30000 / 29 = 1034.4827... rounded to 2dp = 1034.48 → × 29 = 30000.0 (float epsilon ok)
    expect(r.netSalary).toBeCloseTo(30000, 0)
  })

  it('returns 0-net when no attendance and no extras', () => {
    const r = computeSalaryBreakdown(input({ presentDays: 0 }))
    expect(r.netSalary).toBe(0)
  })

  it('net floors at the math result; can be negative (caller decides clamp)', () => {
    // Recurring deduction larger than earned
    const r = computeSalaryBreakdown(input({
      presentDays: 0,
      recurringDeductions: [{ code: 'PT', name: 'PT', amount: 200 }],
    }))
    expect(r.netSalary).toBe(-200)
  })
})
```

- [ ] **Step 2: Run the test, verify it fails (module not found)**

```bash
npm test
```

Expected: failure — `Cannot find module '@/lib/services/salary-math'`.

- [ ] **Step 3: Implement the pure helper**

Create `src/lib/services/salary-math.ts`:

```ts
import type { RecurringDeductionEntry } from '@/models/models'
import { sumRecurringDeductions } from '@/lib/services/recurring-deductions'

export interface SalaryMathInput {
  baseSalary: number
  daysInMonth: number
  presentDays: number          // can be fractional (half-days = 0.5)
  overtimeDays: number
  leavesEarned: number
  otherBonuses: number
  advanceTotal: number
  recurringDeductions: RecurringDeductionEntry[]
}

export interface SalaryBreakdown {
  perDaySalary: number
  presentDaysAmount: number
  overtimeAmount: number
  leaveSalary: number
  recurringTotal: number
  grossEarnings: number        // present + overtime + bonuses + leaveSalary
  totalDeductions: number      // advance + recurring
  netSalary: number            // gross - totalDeductions
}

/**
 * Pure: takes all resolved inputs and returns a complete salary breakdown.
 * No DB, no rounding policy beyond per-day salary (matches existing behavior).
 *
 * Rules baked in:
 *   - per-day salary = baseSalary / daysInMonth (rounded to 2 decimals)
 *   - presentDaysAmount = presentDays × perDaySalary
 *   - overtimeAmount    = overtimeDays × perDaySalary × 0.5  (existing convention)
 *   - leaveSalary       = leavesEarned × perDaySalary
 *   - PT and other recurring deductions are flat — never pro-rated
 *
 * Net salary may be negative (e.g., zero attendance + recurring deduction).
 * Caller decides clamping policy.
 */
export function computeSalaryBreakdown(input: SalaryMathInput): SalaryBreakdown {
  const perDaySalary = Math.round((input.baseSalary / input.daysInMonth) * 100) / 100

  const presentDaysAmount = parseFloat((input.presentDays * perDaySalary).toFixed(2))
  const overtimeAmount = parseFloat((input.overtimeDays * perDaySalary * 0.5).toFixed(2))
  const leaveSalary = parseFloat((input.leavesEarned * perDaySalary).toFixed(2))

  const recurringTotal = sumRecurringDeductions(input.recurringDeductions)

  const grossEarnings = presentDaysAmount + overtimeAmount + leaveSalary + input.otherBonuses
  const totalDeductions = input.advanceTotal + recurringTotal
  const netSalary = grossEarnings - totalDeductions

  return {
    perDaySalary,
    presentDaysAmount,
    overtimeAmount,
    leaveSalary,
    recurringTotal,
    grossEarnings,
    totalDeductions,
    netSalary,
  }
}
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
npm test
```

Expected: all `salary-math` tests pass (10 tests). All previously-added `recurring-deductions` tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/salary-math.ts src/lib/services/__tests__/salary-math.test.ts
git commit -m "feat(salary): pure salary-math helper with PT integration tests"
```

---

## Task 6: Wire `computeSalaryBreakdown` + `computeRecurringDeductions` into `calculateSalary`

**Files:**
- Modify: `src/lib/services/salary-calculator.ts`

We replace the inline math in `calculateSalary` with calls to the now-tested pure helpers.

- [ ] **Step 1: Update imports at the top of the file**

```ts
import {
  computeRecurringDeductions,
} from '@/lib/services/recurring-deductions'
import { computeSalaryBreakdown } from '@/lib/services/salary-math'
import type { RecurringDeductionEntry } from '@/models/models'
```

- [ ] **Step 2: Extend the user select inside `calculateSalary`**

Find the `prisma.user.findUnique` call near the top of `calculateSalary` (around line 8). Replace its `select` with:

```ts
    select: {
      salary: true,
      hasWeeklyOff: true,
      optInPT: true,
      optInPF: true,
      optInESI: true,
    },
```

- [ ] **Step 3: Replace the inline math with the pure helper**

Find the block from "Calculate attendance-based salary" (around line 68) through `const roundedSalary = Math.round(netSalary)` (around line 139). Replace the entire calculation block with:

```ts
  // Days in month
  const daysInMonth = endDate.getDate()

  // Earned leaves logic (kept here — depends on attendance shape)
  let leavesEarned = 0
  if (!employee.hasWeeklyOff) {
    const presentDaysForBonusLeaves = attendance
      .filter(day => day.isPresent && !day.isWeeklyOff)
      .reduce((sum, day) => {
        if (day.isHalfDay) return sum + 0.5
        return sum + 1
      }, 0)

    if (presentDaysForBonusLeaves >= 25) leavesEarned = 2
    else if (presentDaysForBonusLeaves >= 15) leavesEarned = 1
  }

  // Recurring deductions snapshot for this month
  const recurringDeductions: RecurringDeductionEntry[] = computeRecurringDeductions(
    {
      optInPT: employee.optInPT ?? false,
      optInPF: employee.optInPF ?? false,
      optInESI: employee.optInESI ?? false,
      salary: employee.salary,
    },
    month,
  )

  // All math via the pure helper — easy to test in isolation
  const breakdown = computeSalaryBreakdown({
    baseSalary: employee.salary,
    daysInMonth,
    presentDays,
    overtimeDays,
    leavesEarned,
    otherBonuses: 0,                  // performance bonus placeholder, matches old code
    advanceTotal: totalAdvanceDeduction,
    recurringDeductions,
  })

  const baseSalary = employee.salary
  const otherBonuses = 0
  const roundedSalary = Math.round(breakdown.netSalary)
```

- [ ] **Step 4: Update the return object**

Replace the existing `return { ... }` block at the end of `calculateSalary` with:

```ts
  return {
    baseSalary,
    deductions: totalAdvanceDeduction,           // legacy key — advance total
    netSalary: breakdown.netSalary,
    attendanceDeduction: 0,
    suggestedAdvanceDeductions,
    overtimeAmount: breakdown.overtimeAmount,
    otherBonuses,
    attendance,
    leavesEarned,
    leaveSalary: breakdown.leaveSalary,
    presentDaysAmount: breakdown.presentDaysAmount,
    presentDays,
    overtimeDays,
    halfDays,
    weeklyOffDays,
    roundedSalary,
    recurringDeductions,
    recurringDeductionTotal: breakdown.recurringTotal,
  }
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -i "salary-calculator\|recurring\|salary-math" | head -20
```

Expected: no new errors.

- [ ] **Step 6: Run tests — confirm green and no regressions**

```bash
npm test
```

Expected: all tests in `recurring-deductions.test.ts` and `salary-math.test.ts` pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/services/salary-calculator.ts
git commit -m "refactor(salary): use pure helpers for calculation, integrate PT"
```

---

## Task 7: Persist recurring deductions in `createOrUpdateSalary`

**Files:**
- Modify: `src/lib/services/salary-calculator.ts`

- [ ] **Step 1: Persist the array on create**

In `createOrUpdateSalary`, find the `tx.salary.upsert(...)` call (around line 191). In the `create:` block, add after `otherDeductions: 0,`:

```ts
        recurringDeductions: salaryDetails.recurringDeductions as unknown as object,
```

(The `as unknown as object` cast is required because Prisma's `Json` field expects `Prisma.InputJsonValue`; our `RecurringDeductionEntry[]` is structurally compatible.)

Also update the `netSalary:` line in the `create:` block. Find:

```ts
        netSalary: salaryDetails.netSalary - totalAdvanceDeduction,
```

Replace with:

```ts
        netSalary: salaryDetails.netSalary,
```

(`netSalary` from `calculateSalary` already accounts for `advanceTotal` and `recurringTotal` after Task 4. The old `- totalAdvanceDeduction` was double-subtracting and is now wrong; this fix unblocks the math going forward. Existing PAID rows are untouched.)

- [ ] **Step 2: Persist the array on update**

In the same `upsert(...)` `update:` block, add:

```ts
        recurringDeductions: salaryDetails.recurringDeductions as unknown as object,
```

And replace:

```ts
        netSalary: salaryDetails.netSalary - totalAdvanceDeduction,
```

with:

```ts
        netSalary: salaryDetails.netSalary,
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "salary-calculator" | head
```

Expected: no new errors.

- [ ] **Step 4: Smoke-test salary generation manually**

Start the dev server in another terminal:

```bash
npm run dev
```

In Prisma Studio, set `optInPT = true` for one test user with salary ≥ 10000. Then trigger salary generation for the current month for that user via the existing UI. Verify the generated `Salary` row has:
- `recurringDeductions` = `[{code: "PT", name: "Professional Tax", amount: 200}]` (or 300 in Feb)
- `netSalary` reflects the deduction.

Also test a user with `optInPT = false` and confirm `recurringDeductions` is `[]` and net salary is unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/salary-calculator.ts
git commit -m "feat(salary): persist recurringDeductions snapshot on Salary"
```

---

## Task 8: Update payslip route to itemize recurring deductions

**Files:**
- Modify: `src/app/api/salary/[id]/payslip/route.ts`

- [ ] **Step 1: Include `recurringDeductions` in the totals math**

Find around line 172–177:

```ts
const totalAdvanceDeductions = advanceInstallments
  .filter(i => i.status === 'APPROVED')
  .reduce((sum, i) => sum + i.amountPaid, 0);
const totalOtherDeductions = salary.otherDeductions;
const totalDeductions = totalAdvanceDeductions + totalOtherDeductions;
```

Replace with:

```ts
const totalAdvanceDeductions = advanceInstallments
  .filter(i => i.status === 'APPROVED')
  .reduce((sum, i) => sum + i.amountPaid, 0);
const totalOtherDeductions = salary.otherDeductions;
const recurringEntries = (salary.recurringDeductions as Array<{ code: string; name: string; amount: number }> | null) ?? [];
const totalRecurringDeductions = recurringEntries.reduce((s, e) => s + e.amount, 0);
const totalDeductions = totalAdvanceDeductions + totalOtherDeductions + totalRecurringDeductions;
```

- [ ] **Step 2: Render an itemized "Statutory Deductions" section in the PDF**

Find the block around line 354–360 (the `if (salary.otherDeductions > 0)` block that renders "Other Deductions"). Right after that block, before the `if (totalDeductions === 0)` check at line 362, insert:

```ts
if (recurringEntries.length > 0) {
  page.drawText('Statutory Deductions:', { x: 60, y, size: 9, font: boldFont, color: textDark });
  y -= 15;
  for (const entry of recurringEntries) {
    page.drawText(`  • ${entry.name}`, { x: 70, y, size: 8, font: regularFont, color: textDark });
    const amountText = formatCurrency(entry.amount);
    const amountWidth = regularFont.widthOfTextAtSize(amountText, 8);
    page.drawText(amountText, { x: 520 - amountWidth, y, size: 8, font: regularFont, color: textDark });
    y -= 12;
  }
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "payslip" | head
```

Expected: no new errors.

- [ ] **Step 4: Manual verify the payslip PDF**

With dev server running and a salary that has PT applied (from Task 5 verification), open `/api/salary/<salaryId>/payslip` in the browser. The PDF should show:
- "Statutory Deductions:" with one bulleted line "• Professional Tax  ₹200" (or ₹300 in Feb)
- Total Deductions row including PT
- Net Salary reduced by PT.

For a salary with no PT, the section should not appear at all.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/salary/[id]/payslip/route.ts
git commit -m "feat(payslip): itemize statutory deductions in PDF"
```

---

## Task 9: Update salary stats route

**Files:**
- Modify: `src/app/api/salary/[id]/stats/route.ts`

- [ ] **Step 1: Include recurring deductions in the totals**

Find around line 121:

```ts
const totalOtherDeductions = salary.otherDeductions
```

Right after it, add:

```ts
const recurringEntries = (salary.recurringDeductions as Array<{ code: string; name: string; amount: number }> | null) ?? [];
const totalRecurringDeductions = recurringEntries.reduce((s, e) => s + e.amount, 0);
```

Find where `totalDeductions` is summed in this file (search for `totalDeductions` near line 121–130) and add `totalRecurringDeductions` to the sum.

- [ ] **Step 2: Expose the array in the response**

Find the return / NextResponse.json block (search for `otherDeductions:` near line 145). Add to the salary fields returned:

```ts
        recurringDeductions: recurringEntries,
        totalRecurringDeductions,
```

- [ ] **Step 3: Adjust net salary computation**

Find the line near 114 that computes `baseSalaryEarned` and the next line that computes net. Add `- totalRecurringDeductions` to the net salary subtraction (don't double-add — read the existing code carefully and add the new total once on the deductions side).

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "stats/route" | head
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/salary/[id]/stats/route.ts
git commit -m "feat(salary): include recurring deductions in salary stats"
```

---

## Task 10: Preserve recurring deductions on adjustment / bulk-update / generate routes

**Files:**
- Modify: `src/app/api/salary/[id]/adjustment/route.ts`
- Modify: `src/app/api/salary/bulk-update-status/route.ts`
- Modify: `src/app/api/salary/generate/route.ts`

The existing routes recompute `netSalary` directly from scalar fields. They must now also subtract `recurringDeductions` so that net salary stays correct after manual adjustments.

- [ ] **Step 1: Adjustment route — subtract recurring deductions**

In `src/app/api/salary/[id]/adjustment/route.ts`, find lines 32–35:

```ts
const newNetSalary = salary.baseSalary +
                    salary.overtimeBonus +
                    (bonusAmount || 0) -
                    (deductionAmount || 0)
```

Replace with:

```ts
const recurringEntries = (salary.recurringDeductions as Array<{ amount: number }> | null) ?? []
const recurringTotal = recurringEntries.reduce((s, e) => s + e.amount, 0)

const newNetSalary = salary.baseSalary +
                    salary.overtimeBonus +
                    (bonusAmount || 0) -
                    (deductionAmount || 0) -
                    recurringTotal
```

(Note: this matches the legacy formula that uses `baseSalary` directly rather than attendance-derived earned salary. We don't refactor that here — that's a separate cleanup. We just stop the bug where applying an adjustment wipes out the PT deduction.)

- [ ] **Step 2: bulk-update-status route — subtract recurring deductions**

In `src/app/api/salary/bulk-update-status/route.ts` line 69:

```ts
netSalary: salary.baseSalary + salary.overtimeBonus + salary.otherBonuses - totalApprovedDeductions - salary.deductions
```

Read 5 lines of surrounding context. Then before this line, compute:

```ts
const recurringEntries = (salary.recurringDeductions as Array<{ amount: number }> | null) ?? []
const recurringTotal = recurringEntries.reduce((s, e) => s + e.amount, 0)
```

Update the formula to:

```ts
netSalary: salary.baseSalary + salary.overtimeBonus + salary.otherBonuses - totalApprovedDeductions - salary.deductions - recurringTotal
```

- [ ] **Step 3: generate route — apply at both recompute spots**

In `src/app/api/salary/generate/route.ts`, lines 390 and 588 both contain similar net salary recomputations using `installment.salary.otherBonuses - …`. For each spot:

1. Read 10 lines of surrounding context to confirm what `installment.salary` includes — the query that loaded `installment.salary` must include `recurringDeductions`. If not, extend the `select` / `include`.
2. Add before the recomputation:

```ts
const recurringEntries = (installment.salary.recurringDeductions as Array<{ amount: number }> | null) ?? []
const recurringTotal = recurringEntries.reduce((s, e) => s + e.amount, 0)
```

3. Subtract `recurringTotal` from the existing net salary expression.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "adjustment|bulk-update|generate" | head
```

Expected: no new errors.

- [ ] **Step 5: Manual verification**

For one test user with PT applied:
- Open the salary detail page, edit "Other Bonuses" via the existing adjustment form, save.
- Confirm the displayed net salary still reflects PT being deducted (i.e., applying a bonus doesn't undo PT).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/salary/[id]/adjustment/route.ts src/app/api/salary/bulk-update-status/route.ts src/app/api/salary/generate/route.ts
git commit -m "feat(salary): preserve recurring deductions in adjustment/bulk/generate"
```

---

## Task 11: Add opt-in checkboxes to user profile form

**Files:**
- Modify: `src/components/users/user-profile-form.tsx`

- [ ] **Step 1: Locate the current form schema and field-rendering area**

Open `src/components/users/user-profile-form.tsx`. Find:
- The Zod schema or form-state definition (search for `salary:` field).
- The rendered form section near the salary input (search for the JSX rendering "Salary").

- [ ] **Step 2: Add three boolean fields to the form schema**

In the form schema (Zod or react-hook-form defaults), add:

```ts
optInPT:  z.boolean().default(false),
optInPF:  z.boolean().default(false),
optInESI: z.boolean().default(false),
```

(Match the actual style used in this file — if it's a plain TS interface, add the same fields as `boolean`.)

In the `defaultValues` (search for where `salary:` is initialized from the user prop), add:

```ts
optInPT:  user?.optInPT  ?? false,
optInPF:  user?.optInPF  ?? false,
optInESI: user?.optInESI ?? false,
```

- [ ] **Step 3: Render the "Statutory Deductions" section**

Right below the existing Salary field section, add:

```tsx
<div className="space-y-3">
  <h3 className="text-sm font-medium">Statutory Deductions</h3>
  <p className="text-xs text-muted-foreground">
    Professional Tax is deducted automatically when enabled and base salary ≥ ₹10,000
    (₹200/month, ₹300 in February).
  </p>

  <FormField
    control={form.control}
    name="optInPT"
    render={({ field }) => (
      <FormItem className="flex items-center gap-2 space-y-0">
        <FormControl>
          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
        </FormControl>
        <FormLabel className="font-normal">Professional Tax (PT)</FormLabel>
      </FormItem>
    )}
  />

  <FormField
    control={form.control}
    name="optInPF"
    render={({ field }) => (
      <FormItem className="flex items-center gap-2 space-y-0">
        <FormControl>
          <Checkbox checked={field.value} disabled />
        </FormControl>
        <FormLabel className="font-normal text-muted-foreground">
          Provident Fund (PF) <span className="text-xs">— coming soon</span>
        </FormLabel>
      </FormItem>
    )}
  />

  <FormField
    control={form.control}
    name="optInESI"
    render={({ field }) => (
      <FormItem className="flex items-center gap-2 space-y-0">
        <FormControl>
          <Checkbox checked={field.value} disabled />
        </FormControl>
        <FormLabel className="font-normal text-muted-foreground">
          ESI <span className="text-xs">— coming soon</span>
        </FormLabel>
      </FormItem>
    )}
  />
</div>
```

(Use whatever `Checkbox` / `FormField` components this file already imports. If they aren't imported, add them following the existing import style.)

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "user-profile-form" | head
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/users/user-profile-form.tsx
git commit -m "feat(users): opt-in checkboxes for PT/PF/ESI in profile form"
```

---

## Task 12: Update user PUT/PATCH route to accept opt-in flags

**Files:**
- Modify: `src/app/api/users/[id]/route.ts` (or whichever route handles user updates)

- [ ] **Step 1: Locate the user update handler**

```bash
grep -rn "PUT\|PATCH" /Users/kunalsharma/theplahouse/opsy/src/app/api/users/\[id\]/route.ts
```

Open the file and find the update handler body where user fields are written.

- [ ] **Step 2: Accept and persist the three flags**

In the request body parsing, add `optInPT`, `optInPF`, `optInESI`. In the `prisma.user.update({ data: { … } })` block, add:

```ts
optInPT:  body.optInPT  ?? undefined,
optInPF:  body.optInPF  ?? undefined,
optInESI: body.optInESI ?? undefined,
```

(`undefined` means "don't touch this field", so older clients that don't send the flags continue to work.)

Also enforce that only HR / MANAGEMENT can set these — check the existing role guard at the top of the handler. If the existing guard already covers these mutations, no change needed; otherwise add a check.

- [ ] **Step 3: Type-check + manual smoke test**

```bash
npx tsc --noEmit 2>&1 | grep "users/\[id\]" | head
```

Run the dev server, open a user's profile, toggle PT on, save. Confirm via Prisma Studio that `optInPT = true` for that user.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/users/[id]/route.ts
git commit -m "feat(users): persist statutory opt-in flags via update route"
```

---

## Task 13: Bulk export API — Excel of opt-in settings

**Files:**
- Create: `src/app/api/users/deduction-settings/export/route.ts`

- [ ] **Step 1: Implement the GET handler**

Create the file with:

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      numId: true,
      name: true,
      salary: true,
      optInPT: true,
      optInPF: true,
      optInESI: true,
    },
    orderBy: { numId: 'asc' },
  })

  return NextResponse.json(users)
}
```

(Note: this returns JSON. The Excel transformation happens client-side, mirroring how `user-data-import-export.tsx` does it. Keeps the API simple and reuses the same pattern.)

- [ ] **Step 2: Manual verify**

```bash
curl -b "<auth-cookie>" http://localhost:3000/api/users/deduction-settings/export | head -c 500
```

Expected: JSON array of users with the seven fields.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/users/deduction-settings/export/route.ts
git commit -m "feat(api): export users' statutory opt-in settings"
```

---

## Task 14: Bulk import API — Excel upload validation + commit

**Files:**
- Create: `src/app/api/users/deduction-settings/import/route.ts`

- [ ] **Step 1: Implement the POST handler**

Create the file with:

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

interface ImportRow {
  uid: string
  optInPT: boolean
  optInPF: boolean
  optInESI: boolean
}

interface ValidationError {
  rowIndex: number
  uid: string
  error: string
}

function parseFlag(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const v = value.trim().toUpperCase()
    if (v === 'Y' || v === 'YES' || v === 'TRUE' || v === '1') return true
    if (v === 'N' || v === 'NO' || v === 'FALSE' || v === '0' || v === '') return false
  }
  return null
}

export async function POST(req: Request) {
  const session = await auth()
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = await req.json() as { rows: Array<Record<string, unknown>> }
  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: 'Invalid payload: rows[] required' }, { status: 400 })
  }

  // Validate every row first; reject the batch on any error
  const errors: ValidationError[] = []
  const parsed: ImportRow[] = []

  // Look up valid UIDs once
  const uids = body.rows.map(r => String(r.UID ?? r.uid ?? '')).filter(Boolean)
  const existing = await prisma.user.findMany({
    where: { id: { in: uids } },
    select: { id: true },
  })
  const validUidSet = new Set(existing.map(u => u.id))

  body.rows.forEach((row, i) => {
    const uid = String(row.UID ?? row.uid ?? '').trim()
    if (!uid) {
      errors.push({ rowIndex: i, uid: '', error: 'Missing UID' })
      return
    }
    if (!validUidSet.has(uid)) {
      errors.push({ rowIndex: i, uid, error: 'UID not found' })
      return
    }
    const pt = parseFlag(row['PT*'] ?? row.PT ?? row.optInPT)
    const pf = parseFlag(row['PF*'] ?? row.PF ?? row.optInPF)
    const esi = parseFlag(row['ESI*'] ?? row.ESI ?? row.optInESI)
    if (pt === null) {
      errors.push({ rowIndex: i, uid, error: 'PT must be Y/N or TRUE/FALSE' })
      return
    }
    if (pf === null) {
      errors.push({ rowIndex: i, uid, error: 'PF must be Y/N or TRUE/FALSE' })
      return
    }
    if (esi === null) {
      errors.push({ rowIndex: i, uid, error: 'ESI must be Y/N or TRUE/FALSE' })
      return
    }
    parsed.push({ uid, optInPT: pt, optInPF: pf, optInESI: esi })
  })

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 400 })
  }

  // Commit all updates in a single transaction
  await prisma.$transaction(
    parsed.map(p =>
      prisma.user.update({
        where: { id: p.uid },
        data: {
          optInPT: p.optInPT,
          optInPF: p.optInPF,
          optInESI: p.optInESI,
        },
      }),
    ),
  )

  return NextResponse.json({ ok: true, updated: parsed.length })
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "deduction-settings" | head
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/users/deduction-settings/import/route.ts
git commit -m "feat(api): bulk import statutory opt-in settings with row validation"
```

---

## Task 15: Bulk Excel page — frontend

**Files:**
- Create: `src/app/(auth)/users/deduction-settings/page.tsx`
- Create: `src/components/users/deduction-settings-page.tsx`

- [ ] **Step 1: Create the server page wrapper**

Create `src/app/(auth)/users/deduction-settings/page.tsx`:

```tsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { DeductionSettingsPage } from '@/components/users/deduction-settings-page'

export default async function Page() {
  const session = await auth()
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    redirect('/dashboard')
  }
  return <DeductionSettingsPage />
}
```

- [ ] **Step 2: Create the client component**

Create `src/components/users/deduction-settings-page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Download, Upload, AlertCircle } from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface UserRow {
  id: string
  numId: number
  name: string | null
  salary: number | null
  optInPT: boolean
  optInPF: boolean
  optInESI: boolean
}

interface ImportError {
  rowIndex: number
  uid: string
  error: string
}

export function DeductionSettingsPage() {
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [importErrors, setImportErrors] = useState<ImportError[]>([])
  const [showErrorDialog, setShowErrorDialog] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/users/deduction-settings/export')
      if (!res.ok) throw new Error('Failed to load')
      setRows(await res.json())
    } catch (e) {
      toast.error('Failed to load users')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function handleDownload() {
    const data = rows.map(r => ({
      'UID': r.id,
      'Employee Number': r.numId,
      'Name': r.name ?? '',
      'Salary': r.salary ?? '',
      'PT*': r.optInPT ? 'Y' : 'N',
      'PF*': r.optInPF ? 'Y' : 'N',
      'ESI*': r.optInESI ? 'Y' : 'N',
    }))
    const sheet = XLSX.utils.json_to_sheet(data)
    sheet['!cols'] = [
      { wch: 28, hidden: true },
      { wch: 16 }, { wch: 24 }, { wch: 12 },
      { wch: 6 }, { wch: 6 }, { wch: 6 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, sheet, 'Deduction Settings')
    XLSX.writeFile(wb, `deduction-settings-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setImportErrors([])
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const parsed = XLSX.utils.sheet_to_json(sheet) as Array<Record<string, unknown>>
      const res = await fetch('/api/users/deduction-settings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed }),
      })
      const result = await res.json()
      if (!res.ok || !result.ok) {
        setImportErrors(result.errors ?? [{ rowIndex: -1, uid: '', error: result.error ?? 'Unknown error' }])
        setShowErrorDialog(true)
        return
      }
      toast.success(`Updated ${result.updated} users`)
      await load()
    } catch (err) {
      toast.error('Upload failed')
      console.error(err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Statutory Deduction Settings</h1>
          <p className="text-sm text-muted-foreground">
            Per-employee opt-ins for Professional Tax (PT), Provident Fund (PF), and ESI.
            PF and ESI are not yet active.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleDownload} variant="outline">
            <Download className="w-4 h-4 mr-2" />Download Excel
          </Button>
          <label className="inline-flex">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
            <Button asChild disabled={uploading}>
              <span><Upload className="w-4 h-4 mr-2" />{uploading ? 'Uploading…' : 'Upload Excel'}</span>
            </Button>
          </label>
        </div>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Emp #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Salary</TableHead>
              <TableHead>PT</TableHead>
              <TableHead>PF</TableHead>
              <TableHead>ESI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.numId}</TableCell>
                <TableCell>{r.name ?? '—'}</TableCell>
                <TableCell>{r.salary ?? '—'}</TableCell>
                <TableCell>{r.optInPT ? 'Y' : 'N'}</TableCell>
                <TableCell>{r.optInPF ? 'Y' : 'N'}</TableCell>
                <TableCell>{r.optInESI ? 'Y' : 'N'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import errors</DialogTitle>
            <DialogDescription>
              No changes were saved. Fix the errors below and re-upload.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>{importErrors.length} row(s) had errors</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                {importErrors.map((e, i) => (
                  <li key={i}>
                    {e.rowIndex >= 0 ? `Row ${e.rowIndex + 2}` : 'File'}: {e.uid && `UID ${e.uid} — `}{e.error}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "deduction-settings" | head
```

Expected: no new errors.

- [ ] **Step 4: Manual verify in dev server**

Visit `/users/deduction-settings`:
- Page loads with the user table.
- "Download Excel" produces a file with seven columns and current Y/N values.
- Edit one row in the file, change PT to `Y`, upload the file → success toast, table refreshes.
- Upload a file with an invalid UID → error dialog lists row + UID + reason; no DB changes.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/users/deduction-settings src/components/users/deduction-settings-page.tsx
git commit -m "feat(users): bulk Excel UI for statutory opt-in settings"
```

---

## Task 16: Add navigation entry for the bulk page

**Files:**
- Modify: navigation/sidebar source

- [ ] **Step 1: Locate the sidebar / nav source**

```bash
grep -rln "Users\|Salary" /Users/kunalsharma/theplahouse/opsy/src --include="*.tsx" | xargs grep -l "href=\"/users" | head
```

Open whichever file lists the user-section nav entries (likely `src/components/layout/sidebar.tsx` or similar).

- [ ] **Step 2: Add a guarded link**

Following the existing entry style, add a link visible only to HR / MANAGEMENT:

```tsx
{['HR', 'MANAGEMENT'].includes(role) && (
  <Link href="/users/deduction-settings">Deduction Settings</Link>
)}
```

(Match the wrapping component, role-check pattern, and styling already used in the file.)

- [ ] **Step 3: Manual verify**

In dev server, log in as HR → see "Deduction Settings" link → click → page loads. Log in as EMPLOYEE → link not visible; visiting the URL directly → redirect to `/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add <sidebar-file>
git commit -m "feat(nav): link to deduction settings page for HR/MANAGEMENT"
```

---

## Task 17: End-to-end manual verification

- [ ] **Step 1: Reset a test user**

In Prisma Studio, pick a test user. Set `salary = 15000`, `optInPT = false`. Generate salary for current month → confirm `recurringDeductions` is `[]` and net salary unaffected.

- [ ] **Step 2: Toggle PT on via UI**

Open the user's profile, check the PT box, save. Confirm in Prisma Studio.

- [ ] **Step 3: Re-generate salary**

Re-run salary generation for that user/month. Confirm:
- `Salary.recurringDeductions = [{code:"PT", name:"Professional Tax", amount: 200}]` (or 300 if month is February).
- `Salary.netSalary` reduced by 200/300 vs. step 1.

- [ ] **Step 4: Threshold edge cases**

Set `salary = 10000` → PT applies. Set `salary = 9999` → PT doesn't apply. Re-generate each time; confirm.

- [ ] **Step 5: Adjustment flow**

On a salary with PT applied, open the adjustment form, add ₹500 bonus, save. Confirm net salary = (previous net + 500), i.e., PT is still subtracted.

- [ ] **Step 6: Payslip PDF**

Open `/api/salary/<id>/payslip` for the PT-applied salary. Confirm "Statutory Deductions" section renders with "Professional Tax  ₹200" and net salary line is correct.

- [ ] **Step 7: Bulk Excel round-trip**

Visit `/users/deduction-settings`. Download → edit one user's PT to `N` in Excel → upload → confirm toast, table reflects the change, Prisma Studio confirms the DB row.

- [ ] **Step 8: Permission check**

Log in as EMPLOYEE → confirm the "Deduction Settings" nav entry is hidden, direct URL redirects, and `POST /api/users/deduction-settings/import` returns 401 via curl.

- [ ] **Step 9: Final test suite run**

Run the full vitest suite once more to ensure pure logic still passes after all integrations:

```bash
npm test
```

Expected: all tests in `recurring-deductions.test.ts` and `salary-math.test.ts` pass (18 tests total).

---

## Self-Review (already performed)

- **Spec coverage:** Data model (Tasks 1–2), test framework setup (3), pure helpers with tests (4–5), calculator integration (6–7), payslip itemization (8–9), persistence preservation across adjustment flows (10), per-user UI (11–12), bulk Excel (13–15), navigation (16), end-to-end verification (17). All sections of the spec are covered.
- **Placeholder scan:** No "TBD"/"add error handling" placeholders. Code in each step is concrete. Error handling for bulk import is shown in full (Task 14).
- **Type consistency:** `RecurringDeductionEntry` defined once in `models.ts` (Task 2) and reused as the contract everywhere downstream. `computeRecurringDeductions` signature stable across Tasks 4, 6. `SalaryMathInput` / `SalaryBreakdown` defined in Task 5 and consumed in Task 6. JSON cast pattern (`as Array<{code, name, amount}>`) consistent in payslip/stats/bulk routes.
- **Test coverage:** 8 tests for `computeRecurringDeductions` cover all PT branches (opt-in × salary threshold × month). 10 tests for `computeSalaryBreakdown` cover present-day pay, overtime, leaves, advances, recurring deductions, PT-not-pro-rated, and the negative-net edge case. The integration in `calculateSalary` is verified manually in Task 17.
- **Open-spec items:** Sidebar source location is grep-discovered in Task 16 since it's environment-dependent. The PF/ESI checkbox decision (disabled, "coming soon") is locked in per spec.
