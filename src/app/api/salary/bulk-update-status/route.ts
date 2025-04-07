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

    const { salaryIds } = await request.json()

    if (!salaryIds || !Array.isArray(salaryIds) || salaryIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid salary IDs' },
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

    // Validate all salaries first
    const validationResults = salaries.map(salary => {
      const hasPendingInstallments = salary.installments.some(
        inst => inst.status === 'PENDING'
      )

      return {
        salaryId: salary.id,
        isValid: !hasPendingInstallments,
        error: hasPendingInstallments 
          ? 'Has pending advance payment installments'
          : null
      }
    })

    // Check if any salaries have pending installments
    const invalidSalaries = validationResults.filter(result => !result.isValid)
    if (invalidSalaries.length > 0) {
      return NextResponse.json({
        error: 'Some salaries have pending installments',
        details: invalidSalaries
      }, { status: 400 })
    }

    // Process only valid salaries
    const validSalaryIds = validationResults
      .filter(result => result.isValid)
      .map(result => result.salaryId)

    await prisma.$transaction(async (tx) => {
      for (const salaryId of validSalaryIds) {
        const salary = salaries.find(s => s.id === salaryId)!

        // Get approved installments
        const approvedInstallments = salary.installments.filter(
          inst => inst.status === 'APPROVED'
        )

        // Calculate total approved deductions
        const totalApprovedDeductions = approvedInstallments.reduce(
          (sum, inst) => sum + inst.amountPaid,
          0
        )

        // Update salary
        await tx.salary.update({
          where: { id: salaryId },
          data: {
            status: 'PROCESSING',
            advanceDeduction: totalApprovedDeductions,
            netSalary: salary.baseSalary + salary.overtimeBonus + salary.otherBonuses - totalApprovedDeductions - salary.deductions
          }
        })

        // Delete any remaining pending installments
        await tx.advancePaymentInstallment.deleteMany({
          where: {
            salaryId,
            status: 'PENDING'
          }
        })
      }
    })

    return NextResponse.json({
      message: `Successfully processed ${validSalaryIds.length} salaries`,
      processedIds: validSalaryIds
    })

  } catch (error) {
    console.error('Error updating salaries:', error)
    return NextResponse.json(
      { error: 'Failed to update salaries' },
      { status: 500 }
    )
  }
} 
