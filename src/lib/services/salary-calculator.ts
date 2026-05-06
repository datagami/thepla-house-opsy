import { AdvancePayment, Salary } from "@/models/models";
import { prisma } from '@/lib/prisma'
import { SalaryStatus } from "@prisma/client";
import { computeRecurringDeductions } from '@/lib/services/recurring-deductions'
import { computeSalaryBreakdown } from '@/lib/services/salary-math'
import type { RecurringDeductionEntry } from '@/models/models'


export async function calculateSalary(userId: string, month: number, year: number) {
  // Get employee base salary
  const employee = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      salary: true,
      hasWeeklyOff: true,
      optInPT: true,
      optInPF: true,
      optInESI: true,
    },
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
  let halfDays = 0;
  let weeklyOffDays = 0;

  attendance.forEach(day => {
    // Weekly off days are counted as present for salary calculation
    if (day.isWeeklyOff && day.isPresent) {
      presentDays += 1;
      weeklyOffDays += 1;
      return;
    }

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

  // Days in month
  const daysInMonth = endDate.getDate()

  // Earned leaves logic (kept here — depends on attendance shape)
  let leavesEarned = 0
  if (!employee.hasWeeklyOff) {
    const presentDaysForBonusLeaves = attendance
      .filter(day => day.isPresent && !day.isWeeklyOff)
      .reduce((sum, day) => {
        if (day.isHalfDay) return sum + 0.5
        return sum + 1
      }, 0)

    if (presentDaysForBonusLeaves >= 25) leavesEarned = 2
    else if (presentDaysForBonusLeaves >= 15) leavesEarned = 1
  }

  // Recurring deductions snapshot for this month
  const recurringDeductions: RecurringDeductionEntry[] = computeRecurringDeductions(
    {
      optInPT: employee.optInPT ?? false,
      optInPF: employee.optInPF ?? false,
      optInESI: employee.optInESI ?? false,
      salary: employee.salary,
    },
    month,
  )

  // All math via the pure helper — easy to test in isolation
  const breakdown = computeSalaryBreakdown({
    baseSalary: employee.salary,
    daysInMonth,
    presentDays,
    overtimeDays,
    leavesEarned,
    otherBonuses: 0,                  // performance bonus placeholder, matches old code
    advanceTotal: totalAdvanceDeduction,
    recurringDeductions,
  })

  const baseSalary = employee.salary
  const otherBonuses = 0
  const roundedSalary = Math.round(breakdown.netSalary)

  return {
    baseSalary,
    deductions: totalAdvanceDeduction,           // legacy key — advance total
    netSalary: breakdown.netSalary,
    attendanceDeduction: 0,
    suggestedAdvanceDeductions,
    overtimeAmount: breakdown.overtimeAmount,
    otherBonuses,
    attendance,
    leavesEarned,
    leaveSalary: breakdown.leaveSalary,
    presentDaysAmount: breakdown.presentDaysAmount,
    presentDays,
    overtimeDays,
    halfDays,
    weeklyOffDays,
    roundedSalary,
    recurringDeductions,
    recurringDeductionTotal: breakdown.recurringTotal,
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
        recurringDeductions: salaryDetails.recurringDeductions as unknown as object,
        netSalary: salaryDetails.netSalary,
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
        recurringDeductions: salaryDetails.recurringDeductions as unknown as object,
        netSalary: salaryDetails.netSalary,
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

export function calculateNetSalaryFromObject(salary: Salary) {
  // Calculate present days salary
  const daysInMonth = new Date(salary.year, salary.month, 0).getDate();
  const perDaySalary = Math.round((salary.baseSalary / daysInMonth) * 100) / 100;
  const presentDaysSalary = salary.presentDays * perDaySalary;
  
  // Calculate overtime bonus
  const overtimeSalary = salary.overtimeDays * 0.5 * perDaySalary;
  
  // Calculate leave salary
  const leaveSalary = salary.leavesEarned * perDaySalary;
  
  // Calculate base salary earned
  const baseSalaryEarned = presentDaysSalary + overtimeSalary + salary.otherBonuses + leaveSalary;
  
  // Calculate total deductions
  let totalAdvanceDeductions = 0;
  if (salary.installments) {
  totalAdvanceDeductions = salary.installments
    .filter(i => i.status === 'APPROVED')
    .reduce((sum, i) => sum + i.amountPaid, 0);
  }
  
  // Recurring deductions snapshot (PT, future PF/ESI). Stored on Salary as JSON.
  const recurringEntries = (salary.recurringDeductions as Array<{ amount: number }> | null | undefined) ?? [];
  const recurringTotal = recurringEntries.reduce((sum, e) => sum + e.amount, 0);

  const totalDeductions = totalAdvanceDeductions + salary.otherDeductions + recurringTotal;

  // Calculate net salary
  return Math.round(baseSalaryEarned - totalDeductions);
} 
