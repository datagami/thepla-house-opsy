import {NextResponse} from 'next/server'
import {prisma} from '@/lib/prisma'
import {createOrUpdateSalary} from '@/lib/services/salary-calculator'
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
      // Delete existing PENDING salary if exists
      if (existingSalaryMap.get(user.id) === 'PENDING') {
        await prisma.salary.deleteMany({
          where: {
            userId: user.id,
            month,
            year,
            status: 'PENDING'
          }
        })
      }

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

      // Calculate attendance metrics
      const presentDays = attendanceData.filter(a => a.isPresent && !a.isHalfDay && !a.overtime).length
      const halfDays = attendanceData.filter(a => a.isHalfDay).length
      const overtimeDays = attendanceData.filter(a => a.overtime).length

      // Calculate total present days (including half days)
      const totalPresentDays = presentDays + (halfDays * 0.5) + overtimeDays

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

      // Calculate per day salary
      const perDaySalary = (user.salary || 0) / daysInMonth

      // Calculate base earnings for present days
      const presentDaysEarnings = perDaySalary * totalPresentDays

      // Calculate leave salary
      const leaveSalary = perDaySalary * leavesEarned

      // Calculate overtime bonus (if applicable)
      const overtimeRate = 0.5 // 150% of regular pay for overtime
      const overtimeBonus = overtimeDays * (perDaySalary * overtimeRate)

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
      const netSalary = presentDaysEarnings + leaveSalary + overtimeBonus - advanceDeduction

      // Create new salary record
      return prisma.salary.create({
        data: {
          userId: user.id,
          month,
          year,
          baseSalary,
          advanceDeduction,
          bonuses: overtimeBonus,
          deductions: 0,
          netSalary,
          presentDays: totalPresentDays,
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

    // Return appropriate response
    return NextResponse.json({
      message: `Generated/updated salaries for ${salaries.length} employees`,
      skipped: users.length - usersToProcess.length,
      processed: salaries.length,
      salaries
    })
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
