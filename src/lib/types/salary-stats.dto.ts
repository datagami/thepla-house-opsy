// Salary Stats DTO - Types for the salary stats endpoint response

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
    otherBonuses: number;
    otherDeductions: number;
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
    presentDaysSalary: number;
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

// Request parameters type
export interface SalaryStatsParams {
  id: string; // Salary ID
}

// You can use this type for fetching the stats in your components
export async function fetchSalaryStats(salaryId: string): Promise<SalaryStatsDTO> {
  const response = await fetch(`/api/salary/${salaryId}/stats`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch salary stats: ${response.statusText}`);
  }
  
  return await response.json();
} 