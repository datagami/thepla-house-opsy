import type { Prisma } from '@prisma/client'
import type { calculateSalary } from '@/lib/services/salary-calculator'

type SalaryDetails = Awaited<ReturnType<typeof calculateSalary>>

export interface BuildSalaryCreateDataInput {
  userId: string
  month: number
  year: number
  salaryDetails: SalaryDetails
}

/**
 * Build the data block for `prisma.salary.create()`.
 *
 * Used by both the bulk-generate route (`/api/salary/generate`) and the
 * per-user generate route (`/api/salaries/[userId]/[month]/[year]`). The
 * two paths used to duplicate this payload almost verbatim, and a previous
 * field omission (recurringDeductions) on the per-user path silently
 * skipped PT for any salary generated via the per-user "Generate Salary"
 * button. Centralizing here ensures any future field addition lands on
 * both paths automatically.
 *
 * Always creates the salary in `PENDING` status. Approved-installment
 * advance deduction is intentionally 0 here — installments are linked
 * separately and the value is recomputed at the PROCESSING transition.
 */
export function buildSalaryCreateData(
  input: BuildSalaryCreateDataInput
): Prisma.SalaryUncheckedCreateInput {
  const { userId, month, year, salaryDetails } = input
  return {
    userId,
    month,
    year,
    baseSalary: salaryDetails.baseSalary,
    advanceDeduction: 0,
    overtimeBonus: salaryDetails.overtimeAmount,
    otherBonuses: salaryDetails.otherBonuses,
    deductions: 0,
    netSalary: salaryDetails.netSalary,
    presentDays: salaryDetails.presentDays,
    overtimeDays: salaryDetails.overtimeDays,
    halfDays: salaryDetails.halfDays,
    leavesEarned: salaryDetails.leavesEarned,
    leaveSalary: salaryDetails.leaveSalary,
    recurringDeductions: salaryDetails.recurringDeductions as unknown as Prisma.InputJsonValue,
    status: 'PENDING',
  }
}
