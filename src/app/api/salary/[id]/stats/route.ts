import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from "@/auth"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const {id} = await params;

    const salaryId = id

    // Get the salary record with user details
    const salary = await prisma.salary.findUnique({
      where: { id: salaryId },
      include: {
        user: true
      }
    })


    if (!session) {
      // @ts-expect-error - role is not in the User type
      if (salary?.userId !== session?.user?.id) {
        return new NextResponse('Unauthorized', { status: 401 })
      } else {
        // @ts-expect-error - role is not in the User type
        if (!['HR', 'MANAGEMENT'].includes(session.user.role)) {
          return new NextResponse('Unauthorized', { status: 401 })
        }
      }
    }

    if (!salary) {
      return new NextResponse('Salary record not found', { status: 404 })
    }

    // Get attendance for the month
    const startDate = new Date(salary.year, salary.month - 1, 1)
    const endDate = new Date(salary.year, salary.month, 0)
    
    const attendance = await prisma.attendance.findMany({
      where: {
        userId: salary.userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: 'APPROVED',
      },
    })

    // Get advance installments
    const advanceInstallments = await prisma.advancePaymentInstallment.findMany({
      where: { 
        salaryId: salary.id,
      },
      include: {
        advance: true
      }
    })

    // Calculate attendance stats
    const totalDaysInMonth = endDate.getDate()
    const perDaySalary = Math.round((salary.baseSalary / totalDaysInMonth *100)) /100;
    
    // Count different attendance types
    const regularDays = attendance.filter(a => a.isPresent && !a.isHalfDay && !a.overtime).length
    const halfDays = attendance.filter(a => a.isPresent && a.isHalfDay).length
    const overtimeDays = attendance.filter(a => a.isPresent && a.overtime).length
    const leaveDays = attendance.filter(a => !a.isPresent).length
    const absentDays = attendance.filter(a => !a.isPresent).length
    
    // Calculate present days (counting half days as 0.5)
    const presentDays = regularDays + overtimeDays + (halfDays * 0.5)
    
    // Calculate base salary from present days
    const presentDaysSalary = presentDays * perDaySalary
    
    // Calculate overtime bonus (only the extra 0.5x part)
    const overtimeSalary = overtimeDays * 0.5 * perDaySalary
    
    
    
    // Calculate earned leaves
    let leavesEarned = 0
    if (presentDays >= 25) {
      leavesEarned = 2
    } else if (presentDays >= 15) {
      leavesEarned = 1
    }
    const leaveSalary = leavesEarned * perDaySalary

    // Base salary earned is present days salary plus overtime bonus
    const baseSalaryEarned = presentDaysSalary + overtimeSalary + salary.otherBonuses + leaveSalary;
    
    // Calculate total deductions from approved installments only
    const totalAdvanceDeductions = advanceInstallments
      .filter(i => i.status === 'APPROVED')
      .reduce((sum, i) => sum + i.amountPaid, 0)

    const totalOtherDeductions = salary.otherDeductions

    const totalDeductions = totalAdvanceDeductions + totalOtherDeductions
    
    // Add a count of approved deductions to the response
    const approvedDeductionsCount = advanceInstallments.filter(i => i.status === 'APPROVED').length
    
    // Calculate net salary
    const netSalary = baseSalaryEarned - totalDeductions;
    const roundedNetSalary = Math.round(netSalary);
    
    // Prepare the response
    const stats = {
      salary: {
        id: salary.id,
        month: salary.month,
        year: salary.year,
        status: salary.status,
        baseSalary: salary.baseSalary,
        netSalary: salary.netSalary,
        deductions: salary.deductions,
        leavesEarned: salary.leavesEarned,
        leaveSalary: salary.leaveSalary,
        otherBonuses: salary.otherBonuses,
        otherDeductions: salary.otherDeductions
      },
      employee: {
        id: salary.userId,
        name: salary.user.name,
        email: salary.user.email
      },
      attendance: {
        totalDaysInMonth,
        regularDays,
        halfDays,
        overtimeDays,
        leaveDays,
        absentDays,
        presentDays
      },
      calculation: {
        perDaySalary,
        presentDaysSalary,
        overtimeSalary,
        baseSalaryEarned,
        leavesEarned,
        leaveSalary,
        totalDeductions,
        totalAdvanceDeductions,
        totalOtherDeductions,
        approvedDeductionsCount,
        netSalary,
        roundedNetSalary
      },
      deductions: advanceInstallments.map(i => ({
        id: i.id,
        advanceId: i.advanceId,
        amount: i.amountPaid,
        status: i.status,
        advanceTitle: i.advance.reason,
        approvedAt: i.approvedAt
      }))
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching salary stats:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 
