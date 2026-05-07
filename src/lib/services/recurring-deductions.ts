import type { RecurringDeductionEntry } from '@/models/models'

// Maharashtra PT slabs (gender-neutral simplification):
//   salary < 7,500          → no PT
//   7,500 ≤ salary < 10,000 → ₹175/month, every month
//   salary ≥ 10,000         → ₹200/month, ₹300 in February (annual cap ₹2,500)
const PT_SLAB1_THRESHOLD_INCLUSIVE = 7500
const PT_SLAB2_THRESHOLD_INCLUSIVE = 10000
const PT_AMOUNT_SLAB1 = 175
const PT_AMOUNT_SLAB2_REGULAR = 200
const PT_AMOUNT_SLAB2_FEBRUARY = 300
const FEBRUARY = 2

// Private group insurance (not statutory ESI). Flat per-employee premium.
// The user-facing label is "Insurance"; the DB flag is still optInESI for
// historical reasons.
const INSURANCE_AMOUNT = 500

export interface RecurringDeductionUserInput {
  optInPT: boolean
  optInPF: boolean
  /** DB flag is named optInESI but the deduction is private group insurance. */
  optInESI: boolean
  salary: number | null
}

/**
 * Pure: decides which recurring deductions apply for a user in a given month.
 * Maharashtra PT slabs (see constants above). Flat (not pro-rated).
 * PF flag exists on the user but is intentionally ignored — logic ships later.
 */
export function computeRecurringDeductions(
  user: RecurringDeductionUserInput,
  month: number,
): RecurringDeductionEntry[] {
  const entries: RecurringDeductionEntry[] = []

  if (user.optInPT && user.salary !== null) {
    let amount: number | null = null
    if (user.salary >= PT_SLAB2_THRESHOLD_INCLUSIVE) {
      amount = month === FEBRUARY ? PT_AMOUNT_SLAB2_FEBRUARY : PT_AMOUNT_SLAB2_REGULAR
    } else if (user.salary >= PT_SLAB1_THRESHOLD_INCLUSIVE) {
      amount = PT_AMOUNT_SLAB1
    }
    if (amount !== null) {
      entries.push({ code: 'PT', name: 'Professional Tax', amount })
    }
  }

  if (user.optInESI) {
    entries.push({ code: 'INSURANCE', name: 'Insurance', amount: INSURANCE_AMOUNT })
  }

  return entries
}

export function sumRecurringDeductions(
  entries: RecurringDeductionEntry[] | null | undefined,
): number {
  if (!entries) return 0
  return entries.reduce((sum, e) => sum + e.amount, 0)
}
