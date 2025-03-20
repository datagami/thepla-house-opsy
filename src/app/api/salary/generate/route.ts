import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateSalary, createOrUpdateSalary } from '@/lib/services/salary-calculator'
import { auth } from "@/auth"

export async function POST(req: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { month, year } = await req.json()

    // Validate input
    if (!month || !year) {
      return new NextResponse('Month and year are required', { status: 400 })
    }

    // Get all active employees
    const employees = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
      },
    });

    // Generate salaries for each employee
    const salaries = await Promise.all(
      employees.map(async (employee) => {
        // Check if salary already exists for this month/year
        const existingSalary = await prisma.salary.findFirst({
          where: {
            userId: employee.id,
            month,
            year,
          },
        })

        if (existingSalary) {
          return existingSalary
        }

        // Calculate salary and get suggested advance deductions
        const salaryDetails = await calculateSalary(employee.id, month, year)

        // Create salary with advance deductions
        return createOrUpdateSalary({
          userId: employee.id,
          month,
          year,
          // Convert suggested deductions to actual deductions
          advanceDeductions: salaryDetails.suggestedAdvanceDeductions.map(d => ({
            advanceId: d.advanceId,
            amount: d.suggestedAmount
          }))
        })
      })
    )

    return NextResponse.json(salaries)
  } catch (error) {
    console.error('Error generating salaries:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { 
      salaryId, 
      advanceDeductions, // Array of {advanceId, amount}
      status 
    } = await req.json()

    // Validate input
    if (!salaryId || !advanceDeductions) {
      return new NextResponse('Salary ID and advance deductions are required', { status: 400 })
    }

    // Get existing salary record
    const existingSalary = await prisma.salary.findUnique({
      where: { id: salaryId },
      select: {
        userId: true,
        month: true,
        year: true,
        status: true
      }
    })

    if (!existingSalary) {
      return new NextResponse('Salary record not found', { status: 404 })
    }

    // Only allow editing if salary is in PENDING status
    if (existingSalary.status !== 'PENDING') {
      return new NextResponse('Can only edit pending salary records', { status: 400 })
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
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 
