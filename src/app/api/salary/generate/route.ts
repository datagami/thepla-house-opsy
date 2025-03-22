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

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return new NextResponse('Unauthorized', {status: 401})
    }

    const {
      salaryId,
      advanceDeductions,
      installmentAction, // New parameter for handling individual installments
      installmentId,     // New parameter for handling individual installments
      status
    } = await req.json()

    // Get existing salary record
    const existingSalary = await prisma.salary.findUnique({
      where: { id: salaryId },
      include: {
        installments: true
      }
    })

    if (!existingSalary) {
      return new NextResponse('Salary record not found', {status: 404})
    }

    // Only allow editing if salary is in PENDING status
    if (existingSalary.status !== 'PENDING') {
      return new NextResponse('Can only edit pending salary records', {status: 400})
    }

    // Handle individual installment actions
    if (installmentAction && installmentId) {
      await prisma.$transaction(async (tx) => {
        if (installmentAction === 'APPROVE') {
          await tx.advancePaymentInstallment.update({
            where: { id: installmentId },
            data: {
              status: 'APPROVED',
              paidAt: new Date()
            }
          })
        } else if (installmentAction === 'REJECT') {
          await tx.advancePaymentInstallment.delete({
            where: { id: installmentId }
          })
        }

        // Recalculate total deductions
        const approvedInstallments = await tx.advancePaymentInstallment.findMany({
          where: {
            salaryId,
            status: 'APPROVED'
          }
        })

        const totalDeductions = approvedInstallments.reduce(
          (sum, inst) => sum + inst.amountPaid,
          0
        )

        // Update salary
        await tx.salary.update({
          where: { id: salaryId },
          data: {
            advanceDeduction: totalDeductions,
            netSalary: existingSalary.baseSalary + 
                      existingSalary.bonuses - 
                      totalDeductions
          }
        })
      })

      return NextResponse.json({
        message: `Installment ${installmentAction.toLowerCase()}ed successfully`
      })
    }

    // Handle bulk advance deductions update
    if (advanceDeductions) {
      await createOrUpdateSalary({
        userId: existingSalary.userId,
        month: existingSalary.month,
        year: existingSalary.year,
        salaryId,
        advanceDeductions,
        status
      })
    }

    // Handle status change to PROCESSING
    if (status === 'PROCESSING') {
      await prisma.$transaction(async (tx) => {
        // Delete any pending installments
        await tx.advancePaymentInstallment.deleteMany({
          where: {
            salaryId,
            status: 'PENDING'
          }
        })

        // Update salary status
        await tx.salary.update({
          where: { id: salaryId },
          data: { status: 'PROCESSING' }
        })
      })
    }

    return NextResponse.json({ message: 'Salary updated successfully' })

  } catch (error) {
    console.error('Error updating salary:', error)
    return new NextResponse('Internal Server Error', {status: 500})
  }
}

// Add a new endpoint to manage advance installment approvals
export async function PUT(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return new NextResponse('Unauthorized', {status: 401})
    }

    const { installmentId, action } = await request.json()

    const installment = await prisma.advancePaymentInstallment.findUnique({
      where: { id: installmentId },
      include: {
        salary: true
      }
    })

    if (!installment) {
      return NextResponse.json(
        { error: 'Installment not found' },
        { status: 404 }
      )
    }

    if (installment.salary.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Can only modify installments for pending salaries' },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      if (action === 'APPROVE') {
        // Update installment status
        await tx.advancePaymentInstallment.update({
          where: { id: installmentId },
          data: {
            status: 'APPROVED',
            paidAt: new Date()
          }
        })
      } else if (action === 'REJECT') {
        // Delete the installment
        await tx.advancePaymentInstallment.delete({
          where: { id: installmentId }
        })
      }

      // Recalculate salary deductions and net salary
      const updatedInstallments = await tx.advancePaymentInstallment.findMany({
        where: {
          salaryId: installment.salaryId,
          status: 'APPROVED'
        }
      })

      const totalDeductions = updatedInstallments.reduce(
        (sum, inst) => sum + inst.amountPaid,
        0
      )

      await tx.salary.update({
        where: { id: installment.salaryId },
        data: {
          advanceDeduction: totalDeductions,
          netSalary: installment.salary.baseSalary + 
                     installment.salary.bonuses - 
                     totalDeductions
        }
      })
    })

    return NextResponse.json({
      message: `Installment ${action.toLowerCase()}ed successfully`
    })

  } catch (error) {
    console.error('Error managing installment:', error)
    return NextResponse.json(
      { error: 'Failed to manage installment' },
      { status: 500 }
    )
  }
} 
