import { Attendance } from "@/models/models";
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

  // Calculate attendance-based deductions
  const workingDays = endDate.getDate()
  const presentDays = attendance.filter(a => a.isPresent).length
  const halfDays = attendance.filter(a => a.isHalfDay).length
  const absentDays = workingDays - presentDays - (halfDays / 2)
  
  const perDaySalary = employee.salary / workingDays
  const attendanceDeduction = absentDays * perDaySalary

  // Get advance payment deductions
  const advanceDeductions = await prisma.advancePayment.findMany({
    where: {
      userId,
      status: 'APPROVED',
      isSettled: false,
    },
  })

  const totalAdvanceDeduction = advanceDeductions.reduce(
    (total, advance) => total + advance.emiAmount,
    0
  )

  // Calculate bonuses (you can customize this based on your requirements)
  const overtime = attendance.filter(a => a.overtime).length
  const overtimeBonus = overtime * (perDaySalary * 0.5) // 50% bonus for overtime
  const performanceBonus = 0 // You can implement your performance bonus logic here

  const baseSalary = employee.salary
  const deductions = attendanceDeduction + totalAdvanceDeduction
  const bonuses = overtimeBonus + performanceBonus
  const netSalary = baseSalary - deductions + bonuses

  return {
    baseSalary,
    deductions,
    bonuses,
    netSalary,
    // Additional details for breakdown
    attendanceDeduction,
    advanceDeduction: totalAdvanceDeduction,
    overtimeBonus,
    performanceBonus,
    attendance
  }
} 
