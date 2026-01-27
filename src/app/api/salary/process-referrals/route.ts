import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { logEntityActivity } from '@/lib/services/activity-log'
import { ActivityType } from '@prisma/client'

export async function POST(req: Request) {
  try {
    const session = await auth()
    // @ts-expect-error - role is not in the User type
    if (!session?.user || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
    const sessionUserId = session.user.id!

    const { month, year } = await req.json()
    if (!month || !year) {
      return NextResponse.json({ error: 'Month and year are required' }, { status: 400 })
    }

    // Referrals become eligible one month before they are processed
    // e.g., if eligible in January, bonus is paid in February salary
    const previousMonthEnd = new Date(year, month - 1, 0)

    // Find eligible unpaid referrals
    const referrals = await prisma.referral.findMany({
      where: {
        paidAt: null,
        eligibleAt: { lte: previousMonthEnd }
      }
    })

    if (referrals.length === 0) {
      return NextResponse.json({ message: 'No eligible referrals to process' })
    }

    // Group by referrer and process
    const byReferrer = referrals.reduce<Record<string, typeof referrals>>((acc, r) => {
      (acc[r.referrerId] ||= []).push(r)
      return acc
    }, {})

    const results: Array<{ referrerId: string, count: number, total: number, salaryId: string }> = []

    await prisma.$transaction(async (tx) => {
      for (const [referrerId, refs] of Object.entries(byReferrer)) {
        // Ensure a PENDING salary exists for this referrer for the month/year
        let salary = await tx.salary.findFirst({
          where: { userId: referrerId, month, year }
        })

        if (!salary) {
          // Create minimal pending salary to attach bonus (base values 0; will be recalculated if needed elsewhere)
          salary = await tx.salary.create({
            data: {
              userId: referrerId,
              month,
              year,
              baseSalary: 0,
              advanceDeduction: 0,
              overtimeBonus: 0,
              otherBonuses: 0,
              otherDeductions: 0,
              netSalary: 0,
              presentDays: 0,
              overtimeDays: 0,
              halfDays: 0,
              leavesEarned: 0,
              leaveSalary: 0,
              status: 'PENDING'
            }
          })
        }

        const total = refs.reduce((sum, r) => sum + (r.bonusAmount || 0), 0)

        await tx.salary.update({
          where: { id: salary.id },
          data: {
            otherBonuses: { increment: total },
            netSalary: { increment: total },
          }
        })

        await tx.referral.updateMany({
          where: { id: { in: refs.map(r => r.id) } },
          data: { paidAt: new Date(), salaryId: salary.id }
        })

        results.push({ referrerId, count: refs.length, total, salaryId: salary.id })
      }
    })

    // Log each referral bonus processing
    for (const result of results) {
      await logEntityActivity(
        ActivityType.REFERRAL_BONUS_PROCESSED,
        sessionUserId,
        "Salary",
        result.salaryId,
        `Processed ${result.count} referral bonus(es) totaling ₹${result.total}`,
        { month, year, count: result.count, totalAmount: result.total, referrerId: result.referrerId },
        req
      )
    }

    return NextResponse.json({ processed: results.length, results })
  } catch (error) {
    console.error('Error processing referrals:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}


