import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from "@/auth"
import { createOrUpdateSalary } from '@/lib/services/salary-calculator'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const salaryId = params.id
    const { installmentId, action } = await req.json()

    // Validate input
    if (!installmentId || !action) {
      return new NextResponse('Installment ID and action are required', { status: 400 })
    }

    // Get the salary record
    const salary = await prisma.salary.findUnique({
      where: { id: salaryId },
      include: {
        installments: true
      }
    })

    if (!salary) {
      return new NextResponse('Salary record not found', { status: 404 })
    }

    // Only allow editing if salary is in PENDING status
    if (salary.status !== 'PENDING') {
      return new NextResponse('Can only edit pending salary records', { status: 400 })
    }

    // Get the installment
    const installment = await prisma.advancePaymentInstallment.findUnique({
      where: { id: installmentId },
    })

    if (!installment) {
      return new NextResponse('Installment not found', { status: 404 })
    }

    // Handle the action
    if (action === 'APPROVE') {
      console.log('Approving installment:', installment)
      
      // Keep the installment but update its status
      await prisma.advancePaymentInstallment.update({
        where: { id: installmentId },
        data: {
          status: 'APPROVED',
          approvedById: session.user.id,
          approvedAt: new Date()
        }
      })
      
      console.log('Updated installment status to APPROVED')
      
      // Update the advance payment remaining amount only when approved
      const advance = await prisma.advancePayment.findUnique({
        where: { id: installment.advanceId }
      })
      
      console.log('Current advance state:', advance)
      
      const willBeSettled = advance && advance.remainingAmount - installment.amountPaid <= 0
      console.log('Will be settled:', willBeSettled, 'Remaining after deduction:', advance?.remainingAmount - installment.amountPaid)
      
      await prisma.advancePayment.update({
        where: { id: installment.advanceId },
        data: {
          remainingAmount: {
            decrement: installment.amountPaid
          },
          isSettled: {
            set: willBeSettled
          }
        }
      })
      
      console.log('Updated advance payment remaining amount')
    } else if (action === 'REJECT') {
      // Delete the installment
      await prisma.advancePaymentInstallment.delete({
        where: { id: installmentId }
      })
    } else {
      return new NextResponse('Invalid action', { status: 400 })
    }

    // Get all remaining installments for this salary
    const remainingInstallments = await prisma.advancePaymentInstallment.findMany({
      where: { 
        salaryId,
        status: { in: ['PENDING', 'APPROVED'] }
      }
    })

    // Recalculate salary with updated advance deductions
    const updatedSalary = await createOrUpdateSalary({
      userId: salary.userId,
      month: salary.month,
      year: salary.year,
      salaryId,
      advanceDeductions: remainingInstallments.map(inst => ({
        advanceId: inst.advanceId,
        amount: inst.amountPaid
      })),
      // Don't update advance remaining amounts here since we already did it for approved installments
      updateAdvanceRemaining: false
    })

    return NextResponse.json(updatedSalary)
  } catch (error) {
    console.error('Error updating advance installment:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 