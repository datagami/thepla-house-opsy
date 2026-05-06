import {Prisma, ActivityType} from "@prisma/client"
import {prisma} from "@/lib/prisma"
import {logTargetUserActivity} from "@/lib/services/activity-log"

export interface SalaryAppraisalChange {
  userId: string
  previousSalary: number
  newSalary: number
  changeAmount: number
  changePercentage: number
}

type DbClient = Prisma.TransactionClient | typeof prisma

export async function recordSalaryAppraisal(params: {
  userId: string
  previousSalary: number | null
  newSalary: number
  changedById: string | null
  tx?: DbClient
}): Promise<SalaryAppraisalChange | null> {
  const {userId, previousSalary, newSalary, changedById} = params
  const db = params.tx ?? prisma

  if (
    previousSalary === null ||
    Number.isNaN(newSalary) ||
    previousSalary === newSalary
  ) {
    return null
  }

  const changeAmount = newSalary - previousSalary
  const changePercentage = previousSalary > 0
    ? Math.round((changeAmount / previousSalary) * 10000) / 100
    : 0

  await db.salaryAppraisal.create({
    data: {
      userId,
      previousSalary,
      newSalary,
      changeAmount,
      changePercentage,
      changedById,
    },
  })

  return {userId, previousSalary, newSalary, changeAmount, changePercentage}
}

export async function logSalaryAppraisalActivity(params: {
  change: SalaryAppraisalChange
  changedById: string
  source?: string
  request?: Request
}): Promise<void> {
  const {change, changedById, source, request} = params
  const sourceSuffix = source ? ` via ${source}` : ""
  const sign = change.changePercentage > 0 ? "+" : ""
  await logTargetUserActivity(
    ActivityType.SALARY_APPRAISAL,
    changedById,
    change.userId,
    `Salary changed from ₹${change.previousSalary.toLocaleString()} to ₹${change.newSalary.toLocaleString()} (${sign}${change.changePercentage}%)${sourceSuffix}`,
    {...change},
    request
  )
}
