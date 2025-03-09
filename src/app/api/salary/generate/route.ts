import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateSalary } from '@/lib/services/salary-calculator'
import {auth} from "@/auth";

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

        // Calculate salary components
        const { baseSalary, bonuses, netSalary, deductions, advanceDeduction } =
          await calculateSalary(employee.id, month, year)

        console.log('Salary components:', baseSalary, bonuses, netSalary, deductions)

        // Create new salary record
        return prisma.salary.create({
          data: {
            userId: employee.id,
            deductions,
            month,
            year,
            baseSalary,
            bonuses,
            netSalary,
            advanceDeduction,
            status: 'PENDING'
          },
        })
      })
    )

    return NextResponse.json(salaries)
  } catch (error) {
    console.error('Error generating salaries:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 
