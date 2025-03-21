import {NextResponse} from 'next/server'
import {prisma} from '@/lib/prisma'
import {createOrUpdateSalary} from '@/lib/services/salary-calculator'
import {auth} from "@/auth"

export async function POST(request: Request) {
  try {
    const {month, year} = await request.json()

    // Get all active users
    const users = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        salary: {
          not: null
        }
      }
    })

    const salaries = await Promise.all(users.map(async (user) => {
      // Get attendance data for the month
      const attendanceData = await prisma.attendance.findMany({
        where: {
          userId: user.id,
          date: {
            gte: new Date(year, month - 1, 1),
            lt: new Date(year, month, 1)
          },
          status: 'APPROVED'
        }
      })

      let presentDays = 0;
      let halfDays = 0;
      let overtimeDays = 0;

      console.log(attendanceData);
      for (const attendance of attendanceData) {
        if (attendance.isPresent && attendance.overtime) {
          overtimeDays = overtimeDays + 1;
          presentDays = presentDays + 1;
        } else if (attendance.isPresent && attendance.isHalfDay) {
          halfDays = halfDays + 1;
          presentDays = presentDays + 0.5;
        } else if (attendance.isPresent) {
          presentDays = presentDays + 1;
        }
      }

      // Get leave data for the month
      const leaveData = await prisma.leaveRequest.findMany({
        where: {
          userId: user.id,
          status: 'APPROVED',
          startDate: {
            lte: new Date(year, month, 0) // End of the month
          },
          endDate: {
            gte: new Date(year, month - 1, 1) // Start of the month
          }
        }
      })

      // Calculate leaves earned
      const leavesEarned = leaveData.reduce((total, leave) => {
        const startDate = new Date(Math.max(
          leave.startDate.getTime(),
          new Date(year, month - 1, 1).getTime()
        ))
        const endDate = new Date(Math.min(
          leave.endDate.getTime(),
          new Date(year, month, 0).getTime()
        ))
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
        return total + days
      }, 0)

      // Calculate leave salary (assuming it's based on some business logic)
      const leaveSalary = (user.salary || 0) * (leavesEarned / 30) // Example calculation

      // Get advance payment installments
      const advanceInstallments = await prisma.advancePaymentInstallment.findMany({
        where: {
          userId: user.id,
          status: 'APPROVED',
          advance: {
            status: 'APPROVED'
          }
        }
      })

      const advanceDeduction = advanceInstallments.reduce(
        (total, installment) => total + installment.amountPaid,
        0
      )

      // Calculate net salary
      const baseSalary = user.salary || 0
      const netSalary = baseSalary - advanceDeduction + leaveSalary

      // Create salary record
      return prisma.salary.create({
        data: {
          userId: user.id,
          month,
          year,
          baseSalary,
          advanceDeduction,
          bonuses: 0, // Set based on your business logic
          deductions: 0, // Set based on your business logic
          netSalary,
          presentDays,
          overtimeDays,
          halfDays,
          leavesEarned,
          leaveSalary,
          status: 'PENDING',
          installments: {
            connect: advanceInstallments.map(i => ({id: i.id}))
          }
        }
      })
    }))

    return NextResponse.json(salaries)
  } catch (error) {
    console.error('Error generating salaries:', error)
    return NextResponse.json(
      {error: 'Failed to generate salaries'},
      {status: 500}
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
      advanceDeductions, // Array of {advanceId, amount}
      status
    } = await req.json()

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
