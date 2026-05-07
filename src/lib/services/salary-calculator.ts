import { AdvancePayment, Salary } from "@/models/models";
import { prisma } from '@/lib/prisma'
import { computeRecurringDeductions, sumRecurringDeductions } from '@/lib/services/recurring-deductions'
import { computeSalaryBreakdown, computeNetFromStoredSalary, daysInMonth } from '@/lib/services/salary-math'
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

export function calculateNetSalaryFromObject(salary: Salary) {
  const totalAdvanceDeductions = salary.installments
    ? salary.installments
        .filter(i => i.status === 'APPROVED')
        .reduce((sum, i) => sum + i.amountPaid, 0)
    : 0;

  const recurringTotal = sumRecurringDeductions(
    salary.recurringDeductions as RecurringDeductionEntry[] | null | undefined
  );

  return computeNetFromStoredSalary({
    baseSalary: salary.baseSalary,
    daysInMonth: daysInMonth(salary.year, salary.month),
    presentDays: salary.presentDays,
    overtimeDays: salary.overtimeDays,
    leavesEarned: salary.leavesEarned,
    otherBonuses: salary.otherBonuses,
    otherDeductions: salary.otherDeductions,
    advanceTotal: totalAdvanceDeductions,
    recurringTotal,
  });
} 
