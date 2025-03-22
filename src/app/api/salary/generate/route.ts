import {NextResponse} from 'next/server'
import {prisma} from '@/lib/prisma'
import {calculateSalary, createOrUpdateSalary} from '@/lib/services/salary-calculator'
import {auth} from "@/auth"

export async function POST(request: Request) {
  try {
    const {month, year} = await request.json()
    const daysInMonth = new Date(year, month, 0).getDate()

    // Check for existing salaries for this month
    const existingSalaries = await prisma.salary.findMany({
      where: {
        month,
        year,
      },
      select: {
        userId: true,
        status: true
      }
    })

    // Create a map of existing salaries for quick lookup
    const existingSalaryMap = new Map(
      existingSalaries.map(salary => [salary.userId, salary.status])
    )

    // Get all active users
    const users = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        salary: {
          not: null
        }
      }
    })

    // Filter out users whose salaries are already processed (not in PENDING state)
    const usersToProcess = users.filter(user => {
      const existingStatus = existingSalaryMap.get(user.id)
      return !existingStatus || existingStatus === 'PENDING'
    })

    if (usersToProcess.length === 0) {
      return NextResponse.json(
        { message: 'All salaries for this month have already been processed' },
        { status: 400 }
      )
    }

    const salaries = await Promise.all(usersToProcess.map(async (user) => {
      // Delete existing PENDING salary and its installments if exists
      if (existingSalaryMap.get(user.id) === 'PENDING') {
        await prisma.$transaction([
          prisma.advancePaymentInstallment.deleteMany({
            where: {
              userId: user.id,
              salary: {
                month,
                year,
                status: 'PENDING'
              }
            }
          }),
          prisma.salary.deleteMany({
            where: {
              userId: user.id,
              month,
              year,
              status: 'PENDING'
            }
          })
        ])
      }

      // Calculate salary details including suggested advance deductions
      const salaryDetails = await calculateSalary(user.id, month, year)

      // Get pending advances and calculate suggested installments
      const pendingAdvances = await prisma.advancePayment.findMany({
        where: {
          userId: user.id,
          status: 'APPROVED',
          isSettled: false,
        },
        include: {
          installments: {
            where: {
              salary: {
                month,
                year,
              }
            }
          }
        }
      })

      // Create salary record with suggested advance deductions
      return await prisma.$transaction(async (tx) => {
        // Create the salary record
        const salary = await tx.salary.create({
          data: {
            userId: user.id,
            month,
            year,
            baseSalary: salaryDetails.baseSalary,
            advanceDeduction: 0, // Will be updated when installments are approved
            bonuses: salaryDetails.overtimeAmount,
            deductions: 0,
            netSalary: salaryDetails.netSalary,
            presentDays: salaryDetails.presentDays,
            overtimeDays: salaryDetails.overtimeDays,
            halfDays: salaryDetails.halfDays,
            leavesEarned: salaryDetails.leavesEarned,
            leaveSalary: salaryDetails.leaveSalary,
            status: 'PENDING'
          }
        })

        // Create pending installments for each suggested deduction
        for (const advance of pendingAdvances) {
          // Skip if advance already has an installment for this month
          if (advance.installments.length > 0) continue

          // Calculate suggested amount
          const suggestedAmount = Math.min(
            advance.emiAmount,
            advance.remainingAmount
          )

          if (suggestedAmount > 0) {
            await tx.advancePaymentInstallment.create({
              data: {
                userId: user.id,
                advanceId: advance.id,
                salaryId: salary.id,
                amountPaid: suggestedAmount,
                status: 'PENDING',
                paidAt: null
              }
            })
          }
        }

        return salary
      })
    }))

    return NextResponse.json({
      message: `Generated salaries for ${salaries.length} employees`,
      skipped: users.length - usersToProcess.length,
      processed: salaries.length,
      salaries
    })
  } catch (error) {
    console.error('Error generating salaries:', error)
    return NextResponse.json(
      { error: 'Failed to generate salaries' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return new NextResponse('Unauthorized', {status: 401})
    }

    const {
      salaryId,
      advanceDeductions, // Array of {advanceId, amount}
      status
    } = await request.json()

    // Validate input
    if (!salaryId || !advanceDeductions) {
      return new NextResponse('Salary ID and advance deductions are required', {status: 400})
    }

    // Get existing salary record
    const existingSalary = await prisma.salary.findUnique({
      where: {id: salaryId},
      select: {
        userId: true,
        month: true,
        year: true,
        status: true
      }
    })

    if (!existingSalary) {
      return new NextResponse('Salary record not found', {status: 404})
    }

    // Only allow editing if salary is in PENDING status
    if (existingSalary.status !== 'PENDING') {
      return new NextResponse('Can only edit pending salary records', {status: 400})
    }

    // Update salary with new advance deductions
    await createOrUpdateSalary({
      userId: existingSalary.userId,
      month: existingSalary.month,
      year: existingSalary.year,
      salaryId,
      advanceDeductions,
      status // Optional status update
    })

    return NextResponse.json(null)
  } catch (error) {
    console.error('Error updating salary:', error)
    return new NextResponse('Internal Server Error', {status: 500})
  }
} 
