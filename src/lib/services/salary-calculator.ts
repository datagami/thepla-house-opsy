import { AdvancePayment, Attendance } from "@/models/models";
import { prisma } from '@/lib/prisma'

export interface SalaryBreakup {
  basicSalary: number;
  perDaySalary: number;
  regularDaysAmount: number;
  overtimeAmount: number;
  deductions: number;
  totalSalary: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  overtimeDays: number;
  // Add detailed amounts
  fullDayAmount: number;
  halfDayAmount: number;
}

export function calculateMonthlySalary(
  attendance: Attendance[],
  basicSalary: number | undefined | null
): SalaryBreakup {
  if (!basicSalary) {
    return {
      basicSalary: 0,
      perDaySalary: 0,
      regularDaysAmount: 0,
      overtimeAmount: 0,
      deductions: 0,
      totalSalary: 0,
      presentDays: 0,
      absentDays: 0,
      halfDays: 0,
      overtimeDays: 0,
      fullDayAmount: 0,
      halfDayAmount: 0
    }
  }
  // Calculate total working days in the month
  const totalDays = attendance.length;
  
  // Calculate per day salary
  const perDaySalary = basicSalary / totalDays;

  // Initialize counters
  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let overtimeDays = 0;
  
  // Calculate attendance and amounts
  attendance.forEach(day => {
    if (!day.isPresent) {
      absentDays++;
      return;
    }

    if (day.isHalfDay) {
      halfDays++;
      return;
    }

    if (day.overtime) {
      overtimeDays++;
      return;
    }

    presentDays++;
  });

  // Calculate detailed amounts
  const fullDayAmount = presentDays * perDaySalary;
  const halfDayAmount = halfDays * (perDaySalary * 0.5);
  const overtimeAmount = overtimeDays * (perDaySalary * 1.5);
  const deductions = absentDays * perDaySalary;

  // Calculate total regular days amount
  const regularDaysAmount = fullDayAmount + halfDayAmount;

  // Calculate total salary
  const totalSalary = regularDaysAmount + overtimeAmount;

  return {
    basicSalary,
    perDaySalary,
    regularDaysAmount,
    overtimeAmount,
    deductions,
    totalSalary,
    presentDays,
    absentDays,
    halfDays,
    overtimeDays,
    fullDayAmount,
    halfDayAmount
  };
}

export async function calculateSalary(userId: string, month: number, year: number) {
  // Get employee base salary
  const employee = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!employee?.salary) {
    throw new Error('Employee base salary not found')
  }

  // Get attendance for the month
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)

  const attendance = await prisma.attendance.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      status: 'APPROVED',
    },
  })

  // Initialize counters
  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let overtimeDays = 0;

  attendance.forEach(day => {
    if (!day.isPresent) {
      absentDays++;
      return;
    }

    if (day.isHalfDay) {
      halfDays++;
      return;
    }

    if (day.overtime) {
      overtimeDays++;
      return;
    }

    presentDays++;
  });

  // Calculate attendance-based deductions
  const workingDays = endDate.getDate()
  const perDaySalary = employee.salary / workingDays
  const attendanceDeduction = absentDays * perDaySalary
  console.log('attendance breakdown ---', presentDays, absentDays, halfDays, overtimeDays, perDaySalary, (presentDays * perDaySalary), (halfDays * (perDaySalary * 0.5)), (overtimeDays * (perDaySalary * 1.5)));
  const totalSalary = (presentDays * perDaySalary) + (halfDays * (perDaySalary * 0.5)) + (overtimeDays * (perDaySalary * 1.5))
  const overtimeAmount = overtimeDays * (perDaySalary * 1.5)

  // Get advance payment deductions
  
  const advanceDeductions = await prisma.advancePayment.findMany({
    where: {
      userId,
      status: 'APPROVED',
      isSettled: false,
    },
  }) as AdvancePayment[];

  console.log('advanceDeductions', advanceDeductions);
  let totalAdvanceDeduction = 0;

  // create entries in AdvancePaymentInstallment table
  advanceDeductions.forEach(async (advance) => {
    const amount = Math.min(advance.emiAmount, advance.remainingAmount);
    await prisma.advancePaymentInstallment.create({
      data: {
        userId,
        status: 'PENDING',
        advanceId: advance.id,
        amountPaid: amount,
        paidAt: new Date(),
      }
    })
    totalAdvanceDeduction += amount;
  })

  // Calculate bonuses (you can customize this based on your requirements)
  const performanceBonus = 0 // You can implement your performance bonus logic here

  const baseSalary = employee.salary
  const deductions = totalAdvanceDeduction
  const bonuses =  performanceBonus
  const netSalary = totalSalary + bonuses - deductions

  return {
    baseSalary,
    deductions,
    bonuses,
    netSalary,
    // Additional details for breakdown
    attendanceDeduction,
    advanceDeduction: totalAdvanceDeduction,
    overtimeAmount,
    performanceBonus,
    attendance
  }
} 
