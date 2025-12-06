import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateSalary } from '@/lib/services/salary-calculator'
import { auth } from "@/auth"
import { AdvancePaymentInstallment } from "@/models/models";
import { hasAttendanceConflicts } from "@/lib/services/attendance-conflicts";
import { logEntityActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const {month, year} = await request.json()

    if (!month || !year) {
      return NextResponse.json(
        { error: 'Month and year are required' },
        { status: 400 }
      )
    }

    const { hasConflicts, conflicts } = await hasAttendanceConflicts(month, year)
    if (hasConflicts) {
      return NextResponse.json(
        {
          error: 'Resolve duplicate attendance entries before generating payroll',
          conflictsCount: conflicts.length,
          sampleConflicts: conflicts.slice(0, 5).map(conflict => ({
            userId: conflict.userId,
            userName: conflict.userName,
            date: conflict.date,
            entries: conflict.entries.length
          }))
        },
        { status: 409 }
      )
    }

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

      // Create salary record with suggested advance deductions and apply eligible referral bonuses
      return await prisma.$transaction(async (tx) => {
        // Create the salary record
        const salary = await tx.salary.create({
          data: {
            userId: user.id,
            month,
            year,
            baseSalary: salaryDetails.baseSalary,
            advanceDeduction: 0, // Will be updated when installments are approved
            overtimeBonus: salaryDetails.overtimeAmount,
            otherBonuses: salaryDetails.otherBonuses,
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

        // Apply eligible referral bonuses for this referrer (user)
        const monthEnd = new Date(year, month, 0)
        const eligibleReferrals = await tx.referral.findMany({
          where: {
            referrerId: user.id,
            paidAt: null,
            eligibleAt: { lte: monthEnd },
          }
        })

        if (eligibleReferrals.length > 0) {
          const totalReferralBonus = eligibleReferrals.reduce((sum, r) => sum + (r.bonusAmount || 0), 0)
          await tx.salary.update({
            where: { id: salary.id },
            data: {
              otherBonuses: { increment: totalReferralBonus },
              netSalary: { increment: totalReferralBonus },
            }
          })

          await tx.referral.updateMany({
            where: { id: { in: eligibleReferrals.map(r => r.id) } },
            data: { paidAt: new Date(), salaryId: salary.id }
          })
        }

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

    // Log salary generation
    const session = await auth();
    if (session?.user) {
      // @ts-expect-error - id is not in the session type
      const userId = session.user.id;
      for (const salary of salaries) {
        await logEntityActivity(
          ActivityType.SALARY_GENERATED,
          userId,
          "Salary",
          salary.id,
          `Generated salary for user ${salary.userId} for ${month}/${year}`,
          {
            salaryId: salary.id,
            userId: salary.userId,
            month,
            year,
            netSalary: salary.netSalary,
          },
          request
        );
      }
    }

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
      installmentAction,
      installmentId,
      status,
      amount
    } = await req.json()

    // Get existing salary record with its installments
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

    // Handle status change to PROCESSING
    if (status === 'PROCESSING') {
      const { hasConflicts, conflicts } = await hasAttendanceConflicts(existingSalary.month, existingSalary.year)
      if (hasConflicts) {
        return NextResponse.json({
          error: 'Resolve duplicate attendance entries before moving salaries to processing',
          conflictsCount: conflicts.length
        }, { status: 409 })
      }

      // Check for pending installments
      const hasPendingInstallments = existingSalary.installments.some(
        inst => inst.status === 'PENDING'
      )

      if (hasPendingInstallments) {
        return NextResponse.json({
          error: 'Cannot move to processing: There are pending installments that need approval'
        }, { status: 400 })
      }

      await prisma.$transaction(async (tx) => {
        // Get only approved installments
        const approvedInstallments = existingSalary.installments.filter(
          inst => inst.status === 'APPROVED'
        )

        // Calculate total approved deductions
        const totalApprovedDeductions = approvedInstallments.reduce(
          (sum, inst) => sum + inst.amountPaid,
          0
        )

        // Update salary with final calculations
        await tx.salary.update({
          where: { id: salaryId },
          data: {
            status: 'PROCESSING',
            advanceDeduction: totalApprovedDeductions,
            netSalary: existingSalary.baseSalary + 
                      existingSalary.overtimeBonus + 
                      existingSalary.otherBonuses - 
                      totalApprovedDeductions - 
                      existingSalary.deductions
          }
        })

        // Delete any remaining pending installments (just in case)
        await tx.advancePaymentInstallment.deleteMany({
          where: {
            salaryId,
            status: 'PENDING'
          }
        })
      })

      return NextResponse.json({
        message: 'Salary moved to processing successfully'
      })
    }

    // Handle individual installment actions
    if (installmentAction && installmentId) {
      await prisma.$transaction(async (tx) => {
        const installment = await tx.advancePaymentInstallment.findUnique({
          where: { id: installmentId },
          include: {
            advance: true,
            salary: true
          }
        })

        if (!installment) {
          throw new Error('Installment not found')
        }

        if (installmentAction === 'EDIT') {

          // Validate amount
          if (amount > installment.advance.remainingAmount) {
            throw new Error('Amount exceeds remaining advance balance')
          }

          // Update installment amount
          await tx.advancePaymentInstallment.update({
            where: { id: installmentId },
            data: {
              amountPaid: amount
            }
          })

          // Recalculate salary deductions
          const allInstallments = await tx.advancePaymentInstallment.findMany({
            where: {
              salaryId: installment.salaryId,
              status: 'APPROVED'
            }
          }) as AdvancePaymentInstallment[];

          const totalDeductions = allInstallments.reduce(
            (sum, inst) => sum + inst.amountPaid,
            0
          )

          // Update salary
          await tx.salary.update({
            where: { id: installment.salaryId },
            data: {
              advanceDeduction: totalDeductions,
              netSalary: installment.salary.baseSalary + 
                        installment.salary.overtimeBonus + 
                        installment.salary.otherBonuses - 
                        totalDeductions - 
                        installment.salary.deductions
            }
          })
        } else if (installmentAction === 'APPROVE') {
          // Update installment status
          await tx.advancePaymentInstallment.update({
            where: { id: installmentId },
            data: {
              status: 'APPROVED',
              paidAt: new Date()
            }
          })

          // Update advance payment remaining amount
          const newRemainingAmount = installment.advance.remainingAmount - installment.amountPaid
          await tx.advancePayment.update({
            where: { id: installment.advanceId },
            data: {
              remainingAmount: newRemainingAmount,
              // Set isSettled to true if remaining amount is 0
              isSettled: newRemainingAmount <= 0
            }
          })
        } else if (installmentAction === 'REJECT') {
          await tx.advancePaymentInstallment.delete({
            where: { id: installmentId }
          })
        }
      })

      return NextResponse.json({
        message: `Installment ${
          installmentAction === 'EDIT' ? 'updated' : installmentAction.toLowerCase() + 'ed'
        } successfully`
      })
    }

    // Handle bulk advance deductions update
    if (advanceDeductions) {
      // First validate all advance deductions
      const advanceIds = advanceDeductions.map((ad: AdvancePaymentInstallment) => ad.advanceId)
      
      // Get all advances with their current remaining amounts
      const advances = await prisma.advancePayment.findMany({
        where: {
          id: {
            in: advanceIds
          }
        }
      })

      // Validate amounts against remaining balances
      for (const deduction of advanceDeductions) {
        const advance = advances.find(a => a.id === deduction.advanceId)
        if (!advance) {
          return NextResponse.json({
            error: `Advance payment not found for id: ${deduction.advanceId}`
          }, { status: 400 })
        }

        if (deduction.amount > advance.remainingAmount) {
          return NextResponse.json({
            error: `Deduction amount ${deduction.amount} exceeds remaining balance ${advance.remainingAmount} for advance ${deduction.advanceId}`
          }, { status: 400 })
        }
      }

      // If validation passes, process all deductions in a transaction
      await prisma.$transaction(async (tx) => {
        // Update each advance payment's remaining amount
        for (const deduction of advanceDeductions) {
          const advance = advances.find(a => a.id === deduction.advanceId)!
          const newRemainingAmount = advance.remainingAmount - deduction.amount

          await tx.advancePayment.update({
            where: { id: deduction.advanceId },
            data: {
              remainingAmount: newRemainingAmount,
              isSettled: newRemainingAmount <= 0
            }
          })

          // Create or update the installment
          await tx.advancePaymentInstallment.create({
            data: {
              userId: existingSalary.userId,
              advanceId: deduction.advanceId,
              salaryId,
              amountPaid: deduction.amount,
              status: 'APPROVED',
              paidAt: new Date()
            }
          })
        }

        // Calculate total deductions
        const totalDeductions = (advanceDeductions).reduce(
          (sum: number, deduction: AdvancePaymentInstallment) => sum + deduction.amountPaid,
          0
        )

        // Update salary
        await tx.salary.update({
          where: { id: salaryId },
          data: {
            advanceDeduction: totalDeductions,
            netSalary: existingSalary.baseSalary + 
                      existingSalary.overtimeBonus + 
                      existingSalary.otherBonuses - 
                      totalDeductions - 
                      existingSalary.deductions
          }
        })
      })

      return NextResponse.json({
        message: 'Advance deductions updated successfully'
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
                     installment.salary.overtimeBonus + 
                     installment.salary.otherBonuses - 
                     totalDeductions - 
                     installment.salary.deductions
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
