import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from "@/auth"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const {id} = await params;
    
    // Check if user is authorized (HR or MANAGEMENT)
    // @ts-expect-error - role is not in the User type
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user?.role)) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const salaryId = id
    const { installmentId, action } = await req.json()

    if (!installmentId || !['APPROVE', 'REJECT'].includes(action)) {
      return new NextResponse('Invalid request data', { status: 400 })
    }

    // Get the installment
    const installment = await prisma.advancePaymentInstallment.findUnique({
      where: { id: installmentId },
      include: {
        advance: true
      }
    })

    if (!installment) {
      return new NextResponse('Installment not found', { status: 404 })
    }

    if (installment.status !== 'PENDING') {
      return new NextResponse(`Installment is already ${installment.status.toLowerCase()}`, { status: 400 })
    }

    // Handle the action
    if (action === 'APPROVE') {
      // Get the advance payment to validate amount
      const advance = await prisma.advancePayment.findUnique({
        where: { id: installment.advanceId }
      })
      
      if (!advance) {
        return new NextResponse('Advance payment not found', { status: 404 })
      }
      
      // Validate that the installment amount is not greater than the remaining amount
      if (installment.amountPaid > advance.remainingAmount) {
        return new NextResponse(
          `Installment amount (${installment.amountPaid}) exceeds remaining amount (${advance.remainingAmount})`, 
          { status: 400 }
        )
      }
      
      // Calculate if this will settle the advance
      const willBeSettled = advance.remainingAmount - installment.amountPaid <= 0
      
      // Update the installment status
      await prisma.advancePaymentInstallment.update({
        where: { id: installmentId },
        data: {
          status: 'APPROVED',
          approvedById: session.user?.id,
          approvedAt: new Date()
        }
      })
      
      // Update the advance payment remaining amount
      await prisma.advancePayment.update({
        where: { id: installment.advanceId },
        data: {
          remainingAmount: {
            decrement: installment.amountPaid
          },
          isSettled: willBeSettled
        }
      })

      // Update the salary deductions and net salary
      const salary = await prisma.salary.findUnique({
        where: { id: salaryId }
      })

      if (salary) {
        await prisma.salary.update({
          where: { id: salaryId },
          data: {
            deductions: {
              increment: installment.amountPaid
            },
            netSalary: {
              decrement: installment.amountPaid
            }
          }
        })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Installment approved successfully',
        data: {
          amountPaid: installment.amountPaid,
          remainingAmount: advance.remainingAmount - installment.amountPaid,
          isSettled: willBeSettled
        }
      })
    } else {
      // REJECT action
      await prisma.advancePaymentInstallment.update({
        where: { id: installmentId },
        data: {
          status: 'REJECTED',
          approvedById: session.user?.id,
          approvedAt: new Date()
        }
      })

      return NextResponse.json({ success: true, message: 'Installment rejected successfully' })
    }
  } catch (error) {
    console.error('Error updating advance installment:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

// Add a PUT endpoint to update installment amounts
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    // Check if user is authorized (HR or MANAGEMENT)
    // @ts-expect-error - role is not in the User type
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user?.role)) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const salaryId = params.id
    const { installmentId, amount } = await req.json()

    if (!installmentId || typeof amount !== 'number' || amount < 0) {
      return new NextResponse('Invalid request data', { status: 400 })
    }

    // Get the installment
    const installment = await prisma.advancePaymentInstallment.findUnique({
      where: { id: installmentId },
      include: {
        advance: true
      }
    })

    if (!installment) {
      return new NextResponse('Installment not found', { status: 404 })
    }

    if (installment.status !== 'PENDING') {
      return new NextResponse('Can only update pending installments', { status: 400 })
    }

    // Get the advance payment to validate amount
    const advance = await prisma.advancePayment.findUnique({
      where: { id: installment.advanceId }
    })
    
    if (!advance) {
      return new NextResponse('Advance payment not found', { status: 404 })
    }
    
    // Validate that the new amount is not greater than the remaining amount
    if (amount > advance.remainingAmount) {
      return new NextResponse(
        `Installment amount (${amount}) exceeds remaining amount (${advance.remainingAmount})`, 
        { status: 400 }
      )
    }

    // Update the installment amount
    const updatedInstallment = await prisma.advancePaymentInstallment.update({
      where: { id: installmentId },
      data: {
        amountPaid: amount
      }
    })

    // Get the salary to update the total deductions
    const salary = await prisma.salary.findUnique({
      where: { id: salaryId },
      include: {
        installments: {
          where: {
            status: 'APPROVED'
          }
        }
      }
    })

    if (salary) {
      // Calculate total approved deductions
      const totalApprovedDeductions = salary.installments.reduce(
        (sum, inst) => sum + inst.amountPaid, 
        0
      )

      // Update the salary with the new total deductions
      await prisma.salary.update({
        where: { id: salaryId },
        data: {
          deductions: totalApprovedDeductions
        }
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Installment amount updated successfully',
      data: updatedInstallment
    })
  } catch (error) {
    console.error('Error updating installment amount:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 
