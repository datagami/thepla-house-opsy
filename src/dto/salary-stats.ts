export interface SalaryStatsDTO {
  salary: {
    id: string;
    month: number;
    year: number;
    status: string;
    baseSalary: number;
    netSalary: number;
    deductions: number;
    leavesEarned: number;
    leaveSalary: number;
  };
  employee: {
    id: string;
    name: string | null;
    email: string | null;
  };
  attendance: {
    totalDaysInMonth: number;
    regularDays: number;
    halfDays: number;
    overtimeDays: number;
    leaveDays: number;
    absentDays: number;
    presentDays: number;
  };
  calculation: {
    perDaySalary: number;
    regularDaysSalary: number;
    halfDaysSalary: number;
    overtimeSalary: number;
    baseSalaryEarned: number;
    leavesEarned: number;
    leaveSalary: number;
    totalDeductions: number;
    netSalary: number;
  };
  deductions: Array<{
    id: string;
    advanceId: string;
    amount: number;
    status: string;
    advanceTitle: string;
    approvedAt: Date | null;
  }>;
}
