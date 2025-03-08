import { Attendance } from "@/models/models";

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
  console.log(basicSalary);
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
