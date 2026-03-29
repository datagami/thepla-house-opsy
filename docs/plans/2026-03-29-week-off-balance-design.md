# Week Off Balance & Encashment System

**Date:** 2026-03-29
**Status:** Approved

## Problem

Employees with weekly off have no tracking of unused week-offs. There is no mechanism to:
- Pay employees extra when they work on their off day
- Allow managers to accumulate unused week-offs for future use
- Enforce a cap on how many week-offs can be taken per month

## Design

### Core Concept: Ledger-Based Tracking

All week-off credits and debits are tracked in a `WeekOffCredit` ledger table. Balance is always computed (never stored as a mutable counter), eliminating drift and enabling full audit trails.

### Schema Changes

#### New Model: `WeekOffCredit`

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| userId | String | FK to User |
| date | DateTime | Date this entry is for |
| type | String | CREDIT or DEBIT |
| reason | String | WEEKLY_GRANT, WEEK_OFF_TAKEN, ENCASHMENT, MANUAL_ADJUSTMENT, DELETION_REVERSAL |
| amount | Float | +1, -1, -0.5, etc. |
| attendanceId | String? | Linked attendance record (for DEBIT/REVERSAL) |
| salaryId | String? | Linked salary record (for ENCASHMENT) |
| createdAt | DateTime | When this entry was created |
| createdBy | String? | Who triggered it (cron/HR/system) |

#### User Model: New Field

- `encashWeekOffs Boolean @default(true)` - When true, unused week-offs are paid out at salary time. When false, they carry forward.

#### Salary Model: New Fields

- `weeklyOffDays Int @default(0)` - Week-off days taken that month
- `unusedWeekOffs Int @default(0)` - Unused week-offs that month
- `weekOffAdjustment Float @default(0)` - Payout amount for unused week-offs

### Balance Computation

Balance is always derived from the ledger:

```
weekOffBalance = SUM(amount) FROM WeekOffCredit WHERE userId = X
```

Monthly unused calculation:

```
creditsThisMonth = SUM(amount) WHERE type = CREDIT AND date in month
debitsThisMonth  = SUM(amount) WHERE type = DEBIT AND reason = WEEK_OFF_TAKEN AND date in month
unusedThisMonth  = creditsThisMonth + debitsThisMonth (debits are negative)
```

### Ledger Entries by Scenario

| Event | Type | Reason | Amount |
|-------|------|--------|--------|
| Sunday cron grants weekly credit | CREDIT | WEEKLY_GRANT | +1 |
| Employee takes a week-off | DEBIT | WEEK_OFF_TAKEN | -1 |
| Fixed user works half day on off day | DEBIT | WEEK_OFF_TAKEN | -0.5 |
| Salary encashment (encash users only) | DEBIT | ENCASHMENT | -(unused count) |
| HR deletes a week-off attendance | CREDIT | DELETION_REVERSAL | +1 |
| HR manual balance adjustment | CREDIT/DEBIT | MANUAL_ADJUSTMENT | +/-N |

### Weekly Cron Job (Sundays)

A new cron job runs every Sunday for all ACTIVE users with `hasWeeklyOff = true`:
- Creates a CREDIT entry with reason WEEKLY_GRANT and amount +1
- Idempotent: checks if a WEEKLY_GRANT for that user+date already exists before inserting
- Only credits users whose activation/join date is on or before that Sunday

### Attendance Changes

#### When creating/updating attendance with `isWeeklyOff: true`:
1. Compute `weekOffBalance` from ledger
2. If balance <= 0, reject the request (return 400: "No week-off balance available. Mark as absent or present.")
3. If balance > 0, create attendance AND insert DEBIT entry (reason: WEEK_OFF_TAKEN, amount: -1)

#### Fixed weekly off users - HR override:
- Currently, the PUT handler auto-forces `isWeeklyOff = true` for fixed users on their off day
- Change: allow HR/Management to explicitly set `isWeeklyOff: false` when the employee worked
- The auto-detection becomes the default only when `isWeeklyOff` is not explicitly provided

#### Attendance deletion:
- When a `isWeeklyOff` attendance is deleted, create a CREDIT entry (reason: DELETION_REVERSAL, amount: +1)

### Salary Calculation Changes

In `salary-calculator.ts`:

1. Query ledger for the month: count WEEKLY_GRANT credits and WEEK_OFF_TAKEN debits
2. Compute `unusedWeekOffs = credits + debits` (debits are negative)
3. For fixed users who worked on their off day: those days already count in `presentDays`. The week-off adjustment accounts for the extra pay.
4. For `encashWeekOffs = true` users:
   - `weekOffAdjustment = unusedWeekOffs * perDaySalary`
   - Create ENCASHMENT debit in ledger (does NOT reset balance - balance stays as-is for future months)
5. For `encashWeekOffs = false` users:
   - `weekOffAdjustment = 0`
   - No encashment debit - balance naturally carries forward

**Important:** Encashment debits are computed from monthly attendance data, not from the running balance. The balance field is only used for real-time "can I take a week-off?" checks.

#### Updated net salary formula:

```
netSalary = (presentDays * perDaySalary)
          + (overtimeDays * 0.5 * perDaySalary)
          + leaveSalary
          + weekOffAdjustment
          + otherBonuses
          - advanceDeductions
          - otherDeductions
```

### Payslip Display

- Line item labeled "Week Off Adjustment" (not "bonus")
- Only shown when `weekOffAdjustment > 0`
- Hidden for all other users to discourage gaming the system

### Employee-Facing UI

Simple card on dashboard/attendance screen:

```
Week Off
Available: 2
Used this month: 3
```

Two numbers only. No mention of encashment, credits, or balance mechanics. Designed for clarity with labour-class workforce.

### Backfill Strategy (March 2026)

Since this is a new feature, a migration script will backfill March 2026:

1. For each active user with `hasWeeklyOff = true`:
   - Count Sundays in March (1, 8, 15, 22, 29) = 5, filtered to only Sundays on or after user's join date
   - Create WEEKLY_GRANT CREDIT entries for each eligible Sunday
2. For each `isWeeklyOff` attendance in March:
   - Create WEEK_OFF_TAKEN DEBIT entries
3. Validation: computed balance should match expected (credits - debits)

Backfill only writes to the new `WeekOffCredit` table. No existing data is modified.

### Test Plan

#### Flexible Week-Off Users:
1. 4-week month, takes all 4 week-offs - adjustment = 0
2. 4-week month, takes 3 week-offs - adjustment = 1 * perDaySalary
3. 4-week month, takes 0 week-offs - adjustment = 4 * perDaySalary
4. 5-week month, takes 4 week-offs - adjustment = 1 * perDaySalary
5. 5-week month, takes 3 week-offs - adjustment = 2 * perDaySalary

#### Fixed Week-Off Users:
6. All off days taken as weekly off - adjustment = 0
7. HR overrides 1 off day to present (working) - adjustment = 1 * perDaySalary
8. Works on 2 off days in 5-week month - adjustment = 2 * perDaySalary
9. Half day on off day - adjustment = 0.5 * perDaySalary

#### Balance & Cap:
10. Balance = 0, tries to take week-off - rejected (400 error)
11. Sunday cron credits balance correctly
12. Cron is idempotent (running twice on same Sunday doesn't double-credit)
13. Mid-month joiner only gets credits for Sundays after join date

#### Encashment:
14. Encash user: salary pays out unused, balance unaffected for next month
15. Non-encash user: no payout, balance carries forward
16. March encashment doesn't prevent April 1st week-off (balance preserved)
17. Salary regeneration doesn't double-count encashment

#### Edge Cases:
18. Attendance deletion returns credit to balance
19. Retroactive attendance for past date creates correct debit
20. Deactivated user mid-month: final salary encashes remaining balance
21. Month boundary: week spanning two months credits/debits to correct month

### Files Impacted

| File | Change |
|------|--------|
| `prisma/schema.prisma` | WeekOffCredit model, User.encashWeekOffs, Salary new fields |
| `src/lib/services/salary-calculator.ts` | Unused week-off calc, adjustment, encashment debit |
| `src/app/api/attendance/route.ts` (POST) | Balance check from ledger, create DEBIT |
| `src/app/api/attendance/[id]/route.ts` (PUT) | HR override for fixed users, balance check |
| `src/app/api/attendance/[id]/route.ts` (DELETE) | DELETION_REVERSAL credit |
| `src/app/api/salary/generate/route.ts` | Save new fields, encashment debit |
| `src/app/api/salary/[id]/payslip/route.ts` | Conditional "Week Off Adjustment" line |
| `src/app/api/salary/[id]/stats/route.ts` | Include new fields in response |
| `src/models/models.ts` | Update TypeScript interfaces |
| New: `src/app/api/cron/weekly-off-credit/route.ts` | Sunday cron for WEEKLY_GRANT |
| New: `src/lib/services/week-off-balance.ts` | Balance computation + availability check |
| New: `src/lib/services/__tests__/week-off-balance.test.ts` | Balance tests |
| New: `src/lib/services/__tests__/salary-calculator.test.ts` | Salary + encashment tests |
| New: `scripts/backfill-march-week-off-credits.ts` | March 2026 backfill |
| UI: employee dashboard component | "Available / Used this month" card |
