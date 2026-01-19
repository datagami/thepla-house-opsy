import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { auth } from "@/auth"

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { salaryIds, status } = await request.json()

    if (!salaryIds || !Array.isArray(salaryIds) || salaryIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid salary IDs' },
        { status: 400 }
      )
    }

    const allowedStatuses = ['PENDING', 'PROCESSING', 'PAID', 'FAILED'] as const
    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Get all salaries with their installments
    const salaries = await prisma.salary.findMany({
      where: {
        id: {
          in: salaryIds
        }
      },
      include: {
        installments: true
      }
    })

    await prisma.$transaction(async (tx) => {
      for (const salary of salaries) {
        const hasPendingInstallments = salary.installments.some((inst) => inst.status === 'PENDING')

        // Disallow moving to PROCESSING/PAID when there are pending installments
        if ((status === 'PROCESSING' || status === 'PAID') && hasPendingInstallments) {
          throw new Error(`Salary ${salary.id} has pending advance payment installments`)
        }

        if (status === 'PROCESSING') {
          // Get approved installments
          const approvedInstallments = salary.installments.filter(
            inst => inst.status === 'APPROVED'
          )

          // Calculate total approved deductions
          const totalApprovedDeductions = approvedInstallments.reduce(
            (sum, inst) => sum + inst.amountPaid,
            0
          )

          await tx.salary.update({
            where: { id: salary.id },
            data: {
              status: 'PROCESSING',
              paidAt: null,
              advanceDeduction: totalApprovedDeductions,
              netSalary: salary.baseSalary + salary.overtimeBonus + salary.otherBonuses - totalApprovedDeductions - salary.deductions
            }
          })

          // Delete any remaining pending installments (safety)
          await tx.advancePaymentInstallment.deleteMany({
            where: {
              salaryId: salary.id,
              status: 'PENDING'
            }
          })
        } else if (status === 'PAID') {
          await tx.salary.update({
            where: { id: salary.id },
            data: {
              status: 'PAID',
              paidAt: new Date(),
            }
          })
        } else if (status === 'FAILED') {
          await tx.salary.update({
            where: { id: salary.id },
            data: {
              status: 'FAILED',
              paidAt: null,
            }
          })
        } else if (status === 'PENDING') {
          await tx.salary.update({
            where: { id: salary.id },
            data: {
              status: 'PENDING',
              paidAt: null,
            }
          })
        }
      }
    })

    return NextResponse.json({
      message: `Successfully updated ${salaries.length} salaries to ${status}`,
      processedIds: salaries.map(s => s.id)
    })

  } catch (error) {
    console.error('Error updating salaries:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update salaries' },
      { status: 500 }
    )
  }
} 
