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
