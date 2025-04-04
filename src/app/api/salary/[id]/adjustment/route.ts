import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    // @ts-expect-error - role is not in the User type
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { bonusAmount, deductionAmount } = await req.json()
    const { id } = await params

    const salary = await prisma.salary.findUnique({
      where: { id },
    })

    if (!salary) {
      return new NextResponse('Salary not found', { status: 404 })
    }

    if (salary.status !== 'PENDING') {
      return new NextResponse('Can only update adjustments for pending salary', { status: 400 })
    }

    // Calculate new net salary by replacing the old adjustments with new ones
    const newNetSalary = salary.baseSalary + 
                        salary.overtimeBonus + 
                        (bonusAmount || 0) - 
                        (deductionAmount || 0)

    const updatedSalary = await prisma.salary.update({
      where: { id },
      data: {
        otherBonuses: bonusAmount || 0,
        otherDeductions: deductionAmount || 0,
        netSalary: newNetSalary,
      },
      include: {
        user: true,
        installments: {
          where: {
            OR: [
              { status: 'PENDING' },
              { status: 'APPROVED' }
            ]
          },
          include: {
            advance: true
          }
        }
      }
    })

    return NextResponse.json(updatedSalary)
  } catch (error) {
    console.error('Error updating adjustments:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 