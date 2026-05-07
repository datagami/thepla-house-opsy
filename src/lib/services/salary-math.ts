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

export interface StoredSalaryNetInput {
  baseSalary: number
  daysInMonth: number
  presentDays: number
  overtimeDays: number
  leavesEarned: number
  otherBonuses: number
  otherDeductions: number
  advanceTotal: number
  recurringTotal: number
}

/**
 * Canonical net-salary calculation used at write time AND for the ENET file.
 *
 * Mirrors `calculateNetSalaryFromObject` so that the value stored in
 * `Salary.netSalary` matches what ENET pays out:
 *
 *   net = round(
 *     presentDays × perDay
 *     + overtimeDays × 0.5 × perDay
 *     + leavesEarned × perDay
 *     + otherBonuses
 *     − advanceTotal
 *     − otherDeductions
 *     − recurringTotal
 *   )
 *
 * Use this everywhere `netSalary` is recomputed (PROCESSING transitions,
 * adjustments, advance updates) to avoid the historical disparity where
 * the stored value silently dropped earned leaves and otherDeductions.
 */
export function computeNetFromStoredSalary(input: StoredSalaryNetInput): number {
  const perDaySalary = Math.round((input.baseSalary / input.daysInMonth) * 100) / 100
  const presentDaysAmount = input.presentDays * perDaySalary
  const overtimeAmount = input.overtimeDays * 0.5 * perDaySalary
  const leaveSalary = input.leavesEarned * perDaySalary
  const grossEarnings = presentDaysAmount + overtimeAmount + leaveSalary + input.otherBonuses
  const totalDeductions = input.advanceTotal + input.otherDeductions + input.recurringTotal
  return Math.round(grossEarnings - totalDeductions)
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}
