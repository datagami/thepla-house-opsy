import { AdvancePayment, Attendance } from "@/models/models";
import { prisma } from '@/lib/prisma'
import { SalaryStatus } from "@prisma/client";

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
      presentDays += 0.5;
      return;
    }

    if (day.overtime) {
      overtimeDays++;
      presentDays += 1;
      return;
    }

    presentDays++;
  });

  // Calculate attendance-based salary
  const workingDays = endDate.getDate()
  const perDaySalary = parseFloat((employee.salary.valueOf() / workingDays).toFixed(2));
  
  // Regular days get 1x per day salary
  const presentDaysAmount = parseFloat((presentDays * perDaySalary).toFixed(2));
  
  // Overtime days get 0.5x per day salary ( half extra)
  const overtimeAmount = parseFloat((overtimeDays * (perDaySalary * 0.5)).toFixed(2));
  
  // Total salary is the sum of all attendance-based amounts
  const totalSalary = presentDaysAmount + overtimeAmount;

  // Get pending advance payments but don't create installments yet
  const pendingAdvances = await prisma.advancePayment.findMany({
    where: {
      userId,
      status: 'APPROVED',
      isSettled: false,
    },
  }) as AdvancePayment[];

  // Calculate suggested advance deductions
  let suggestedAdvanceDeductions = pendingAdvances.map(advance => ({
    advanceId: advance.id,
    suggestedAmount: Math.min(advance.emiAmount, advance.remainingAmount),
    advance: advance
  }));

  let totalAdvanceDeduction = suggestedAdvanceDeductions.reduce(
    (sum, item) => sum + item.suggestedAmount, 
    0
  );

  // Calculate bonuses (you can customize this based on your requirements)
  const performanceBonus = 0 // You can implement your performance bonus logic here

  const baseSalary = employee.salary;
  const deductions = totalAdvanceDeduction;
  const bonuses = performanceBonus;

  // Calculate earned leaves based on attendance
  let leavesEarned = 0;
  if (presentDays >= 25) {
    leavesEarned = 2;
  } else if (presentDays >= 15) {
    leavesEarned = 1;
  }

  // Calculate leave salary (per day salary * earned leaves)
  const leaveSalary = parseFloat((leavesEarned * perDaySalary).toFixed(2));
  
  // Add leave salary to total salary
  const totalSalaryWithLeaves = totalSalary + leaveSalary;
  
  // Update net salary calculation to include leave salary
  const netSalary = totalSalaryWithLeaves + bonuses - deductions;

  return {
    baseSalary,
    deductions,
    bonuses,
    netSalary,
    // Additional details for breakdown
    attendanceDeduction: 0, // Not used in this calculation
    suggestedAdvanceDeductions,
    overtimeAmount,
    performanceBonus,
    attendance,
    leavesEarned,
    leaveSalary,
    // Add detailed amounts for UI
    presentDaysAmount,
    presentDays
  }
}

// New function to create/update salary with advance deductions
export async function createOrUpdateSalary({
  userId,
  month,
  year,
  advanceDeductions, // Array of {advanceId, amount}
  salaryId, // Optional, for updates,
  status, // Optional, for updates
  updateAdvanceRemaining = false // Only update remaining amounts when explicitly requested
}: {
  userId: string;
  month: number;
  year: number;
  advanceDeductions: Array<{ advanceId: string; amount: number }>;
  salaryId?: string;
  status?: string;
  updateAdvanceRemaining?: boolean;
}) {
  const salaryDetails = await calculateSalary(userId, month, year);
  
  // Calculate total deductions from advance payments
  const totalAdvanceDeduction = advanceDeductions.reduce(
    (sum, deduction) => sum + deduction.amount, 
    0
  );
  
  return await prisma.$transaction(async (tx) => {
    // Create or update salary record
    const salary = await tx.salary.upsert({
      where: { 
        id: salaryId ?? 'new',
      },
      create: {
        userId,
        month,
        year,
        baseSalary: salaryDetails.baseSalary,
        deductions: totalAdvanceDeduction,
        bonuses: salaryDetails.bonuses,
        netSalary: salaryDetails.netSalary - totalAdvanceDeduction,
        leavesEarned: salaryDetails.leavesEarned,
        leaveSalary: salaryDetails.leaveSalary
      },
      update: {
        deductions: totalAdvanceDeduction,
        netSalary: salaryDetails.netSalary - totalAdvanceDeduction,
        status: status as SalaryStatus ?? 'PENDING',
        leavesEarned: salaryDetails.leavesEarned,
        leaveSalary: salaryDetails.leaveSalary
      }
    });

    // Delete existing advance installments if updating
    if (salaryId) {
      await tx.advancePaymentInstallment.deleteMany({
        where: { salaryId }
      });
    }

    // Create advance installments
    for (const deduction of advanceDeductions) {
      if (deduction.amount > 0) { // Only create installments for positive amounts
        await tx.advancePaymentInstallment.create({
          data: {
            userId,
            status: 'PENDING',
            advanceId: deduction.advanceId,
            amountPaid: deduction.amount,
            paidAt: new Date(),
            salaryId: salary.id
          }
        });

        // Only update advance payment remaining amount if explicitly requested
        if (updateAdvanceRemaining) {
          // Update advance payment remaining amount
          await tx.advancePayment.update({
            where: { id: deduction.advanceId },
            data: {
              remainingAmount: {
                decrement: deduction.amount
              },
              // Only set as settled if remaining amount will be 0
              isSettled: {
                set: await tx.advancePayment.findUnique({
                  where: { id: deduction.advanceId }
                }).then(advance => 
                  advance && advance.remainingAmount - deduction.amount <= 0
                )
              }
            }
          });
        }
      }
    }

    return salary;
  });
} 
