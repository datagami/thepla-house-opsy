import { AdvancePayment } from "@/models/models";
import { prisma } from '@/lib/prisma'
import { SalaryStatus } from "@prisma/client";


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
  let overtimeDays = 0;
  let halfDays =0

  attendance.forEach(day => {
    if (!day.isPresent) {
      return;
    }

    if (day.isHalfDay) {
      presentDays += 0.5;
      halfDays += 1;
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
  const perDaySalary = Math.ceil(employee.salary.valueOf() / workingDays);
  
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
  const suggestedAdvanceDeductions = pendingAdvances.map(advance => ({
    advanceId: advance.id,
    suggestedAmount: Math.min(advance.emiAmount, advance.remainingAmount),
    advance: advance
  }));

  const totalAdvanceDeduction = suggestedAdvanceDeductions.reduce(
    (sum, item) => sum + item.suggestedAmount,
    0
  );

  // Calculate bonuses (you can customize this based on your requirements)
  const performanceBonus = 0 // You can implement your performance bonus logic here

  const baseSalary = employee.salary;
  const deductions = totalAdvanceDeduction;
  const otherBonuses = performanceBonus;

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
  const netSalary = totalSalaryWithLeaves + otherBonuses - deductions;

  return {
    baseSalary,
    deductions,
    netSalary,
    // Additional details for breakdown
    attendanceDeduction: 0, // Not used in this calculation
    suggestedAdvanceDeductions,
    overtimeAmount,
    otherBonuses,
    attendance,
    leavesEarned,
    leaveSalary,
    // Add detailed amounts for UI
    presentDaysAmount,
    presentDays,
    overtimeDays,
    halfDays
  }
}

// New function to create/update salary with advance deductions
export async function createOrUpdateSalary({
  userId,
  month,
  year,
  advanceDeductions,
  salaryId,
  status,
  updateAdvanceRemaining = false
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
  
  await prisma.$transaction(async (tx) => {
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
        advanceDeduction: totalAdvanceDeduction,
        deductions: totalAdvanceDeduction,
        overtimeBonus: salaryDetails.overtimeAmount,
        otherBonuses: 0,
        otherDeductions: 0,
        netSalary: salaryDetails.netSalary - totalAdvanceDeduction,
        presentDays: salaryDetails.presentDays,
        overtimeDays: salaryDetails.overtimeDays || 0,
        halfDays: salaryDetails.halfDays || 0,
        leavesEarned: salaryDetails.leavesEarned,
        leaveSalary: salaryDetails.leaveSalary,
        status: 'PENDING',
      },
      update: {
        deductions: totalAdvanceDeduction,
        advanceDeduction: totalAdvanceDeduction,
        netSalary: salaryDetails.netSalary - totalAdvanceDeduction,
        status: status as SalaryStatus ?? 'PENDING',
        presentDays: salaryDetails.presentDays,
        overtimeDays: salaryDetails.overtimeDays || 0,
        halfDays: salaryDetails.halfDays || 0,
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
      if (deduction.amount > 0) {
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

        if (updateAdvanceRemaining) {
          await tx.advancePayment.update({
            where: { id: deduction.advanceId },
            data: {
              remainingAmount: {
                decrement: deduction.amount
              },
              isSettled: {
                set: !!(await tx.advancePayment.findUnique({
                  where: { id: deduction.advanceId }
                }).then(advance => 
                  advance && advance.remainingAmount - deduction.amount <= 0
                ))
              }
            }
          });
        }
      }
    }

    return salary;
  });
} 
