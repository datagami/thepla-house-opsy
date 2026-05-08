import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import * as XLSX from 'xlsx';
import { calculateNetSalaryFromObject } from '@/lib/services/salary-calculator';
import { sortBranchesForReport } from '@/lib/branch-order';
import { Salary, RecurringDeductionEntry } from '@/models/models';
import { sumRecurringDeductions } from '@/lib/services/recurring-deductions';

export async function POST(req: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { year, month, nonPaidOnly } = await req.json();

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and month are required' }, { status: 400 });
    }

    // Get salaries for the given month and year. When nonPaidOnly is true, restrict to
    // PENDING and PROCESSING (the second payday on the 10th covers these).
    // paidAt: null is belt-and-suspenders against any future drift between status and paidAt.
    const salaries = await prisma.salary.findMany({
      where: {
        month,
        year,
        ...(nonPaidOnly ? { status: { in: ['PENDING', 'PROCESSING'] }, paidAt: null } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            numId: true,
            title: true,
            branch: true,
            role: true
          }
        },
        installments: true
      }
    }) as unknown as Salary[];

    if (salaries.length === 0) {
      return NextResponse.json(
        { error: nonPaidOnly ? 'No pending or processing salaries for the given month' : 'No salaries found for the given month' },
        { status: 404 }
      );
    }

    // Group salaries by branch
    const salariesByBranch = salaries.reduce((acc, salary) => {
      const branch = salary?.user?.branch?.name || 'OTHER';
      if (!acc[branch]) {
        acc[branch] = [];
      }
      acc[branch].push(salary);
      return acc;
    }, {} as Record<string, typeof salaries>);

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Calculate days in month
    const daysInMonth = new Date(year, month, 0).getDate();

    // Same branch order as financial report (sheets and TOTALS)
    const branchNamesOrdered = sortBranchesForReport(Object.keys(salariesByBranch));

    // Create a sheet for each branch in canonical order
    branchNamesOrdered.forEach((branch) => {
      const branchSalaries = salariesByBranch[branch];
      if (!branchSalaries) return;
      // Generate salary report data for this branch
      const reportData = branchSalaries.map((salary) => {
        // Use calculateNetSalaryFromObject for uniformity
        const netSalary = calculateNetSalaryFromObject(salary);

        // Calculate individual components for the report
        const perDaySalary = Math.round((salary.baseSalary / daysInMonth) * 100) / 100;
        const overtimeSalary = salary.overtimeDays * 0.5 * perDaySalary;
        const leaveSalary = salary.leavesEarned * perDaySalary;
        const totalAdvanceDeductions = salary.installments
          ?.filter(i => i.status === 'APPROVED')
          .reduce((sum, i) => sum + i.amountPaid, 0) || 0;
        const pendingInstallmentsTotal = salary.installments
          ?.filter(i => i.status === 'PENDING')
          .reduce((sum, i) => sum + i.amountPaid, 0) || 0;
        const statutoryDeductions = sumRecurringDeductions(
          salary.recurringDeductions as RecurringDeductionEntry[] | null
        );

        return {
          "EMP ID": salary.user.numId,
          "EMPLOYE NAME": salary.user.name,
          "Basic Salary": salary.baseSalary,
          "Designaton": salary.user.role || '',
          "Days In Month": daysInMonth,
          "Per day salary": perDaySalary,
          "no of present": salary.presentDays,
          "leaves earned": salary.leavesEarned,
          "no of OT": salary.overtimeDays,
          "Advance": totalAdvanceDeductions,
          "leave salary": leaveSalary,
          "OT salary": overtimeSalary,
          "Other Additions": salary.otherBonuses ?? 0,
          "Other Deductions": salary.otherDeductions ?? 0,
          "Statutory Deductions": statutoryDeductions,
          "Net salary": netSalary,
          "Pending Installments (Total)": pendingInstallmentsTotal,
          "Status": (salary.paidAt || salary.status?.toUpperCase() === "PAID") ? "Paid" : "Unpaid",
          "Remark": salary.status
        };
      });

      // Create worksheet for this branch
      const worksheet = XLSX.utils.json_to_sheet(reportData);
      XLSX.utils.book_append_sheet(workbook, worksheet, branch);
    });

    // Create totals sheet
    const totalsData = [];
    const grandTotals = {
      "EMP ID": "TOTAL",
      "EMPLOYE NAME": "",
      "Basic Salary": 0,
      "Designaton": "",
      "Days In Month": daysInMonth,
      "Per day salary": 0,
      "no of present": 0,
      "leaves earned": 0,
      "no of OT": 0,
      "Advance": 0,
      "leave salary": 0,
      "OT salary": 0,
      "Other Additions": 0,
      "Other Deductions": 0,
      "Statutory Deductions": 0,
      "salary": 0,
      "total salary": 0,
      "Pending Installments (Total)": 0,
      "Paid Salary": 0,
      "Unpaid Salary": 0,
      "Status": "",
      "Remark": ""
    };

    // Calculate branch totals and grand totals (same order as sheets)
    branchNamesOrdered.forEach((branch) => {
      const branchSalaries = salariesByBranch[branch];
      if (!branchSalaries) return;
      const branchTotals = {
        "EMP ID": `${branch} TOTAL`,
        "EMPLOYE NAME": "",
        "Basic Salary": 0,
        "Designaton": "",
        "Days In Month": daysInMonth,
        "Per day salary": 0,
        "no of present": 0,
        "leaves earned": 0,
        "no of OT": 0,
        "Advance": 0,
        "leave salary": 0,
        "OT salary": 0,
        "Other Additions": 0,
        "Other Deductions": 0,
        "Statutory Deductions": 0,
        "salary": 0,
        "total salary": 0,
        "Pending Installments (Total)": 0,
        "Paid Salary": 0,
        "Unpaid Salary": 0,
        "Status": "",
        "Remark": ""
      };

      branchSalaries.forEach((salary) => {
        // Use calculateNetSalaryFromObject for uniformity
        const netSalary = calculateNetSalaryFromObject(salary);

        // Calculate individual components for the report
        const perDaySalary = Math.round((salary.baseSalary / daysInMonth) * 100) / 100;
        const presentDaysSalary = salary.presentDays * perDaySalary;
        const overtimeSalary = salary.overtimeDays * 0.5 * perDaySalary;
        const leaveSalary = salary.leavesEarned * perDaySalary;
        const totalAdvanceDeductions = salary.installments
          ?.filter(i => i.status === 'APPROVED')
          .reduce((sum, i) => sum + i.amountPaid, 0) || 0;
        const pendingInstallmentsTotal = salary.installments
          ?.filter(i => i.status === 'PENDING')
          .reduce((sum, i) => sum + i.amountPaid, 0) || 0;
        const statutoryDeductions = sumRecurringDeductions(
          salary.recurringDeductions as RecurringDeductionEntry[] | null
        );
        const otherAdditions = salary.otherBonuses ?? 0;
        const otherDeductions = salary.otherDeductions ?? 0;

        // Check if salary is paid
        const isPaid = salary.paidAt !== null || salary.status?.toUpperCase() === "PAID";

        branchTotals["Basic Salary"] += salary.baseSalary;
        branchTotals["no of present"] += salary.presentDays;
        branchTotals["leaves earned"] += salary.leavesEarned;
        branchTotals["no of OT"] += salary.overtimeDays;
        branchTotals["Advance"] += totalAdvanceDeductions;
        branchTotals["leave salary"] += leaveSalary;
        branchTotals["OT salary"] += overtimeSalary;
        branchTotals["Other Additions"] += otherAdditions;
        branchTotals["Other Deductions"] += otherDeductions;
        branchTotals["Statutory Deductions"] += statutoryDeductions;
        branchTotals["salary"] += presentDaysSalary + overtimeSalary + leaveSalary;
        branchTotals["total salary"] += netSalary;
        branchTotals["Pending Installments (Total)"] += pendingInstallmentsTotal;

        // Add to paid/unpaid totals for branch
        if (isPaid) {
          branchTotals["Paid Salary"] += netSalary;
        } else {
          branchTotals["Unpaid Salary"] += netSalary;
        }

        // Add to grand totals
        grandTotals["Basic Salary"] += salary.baseSalary;
        grandTotals["no of present"] += salary.presentDays;
        grandTotals["leaves earned"] += salary.leavesEarned;
        grandTotals["no of OT"] += salary.overtimeDays;
        grandTotals["Advance"] += totalAdvanceDeductions;
        grandTotals["leave salary"] += leaveSalary;
        grandTotals["OT salary"] += overtimeSalary;
        grandTotals["Other Additions"] += otherAdditions;
        grandTotals["Other Deductions"] += otherDeductions;
        grandTotals["Statutory Deductions"] += statutoryDeductions;
        grandTotals["salary"] += presentDaysSalary + overtimeSalary + leaveSalary;
        grandTotals["total salary"] += netSalary;
        grandTotals["Pending Installments (Total)"] += pendingInstallmentsTotal;

        // Add to paid/unpaid totals for grand totals
        if (isPaid) {
          grandTotals["Paid Salary"] += netSalary;
        } else {
          grandTotals["Unpaid Salary"] += netSalary;
        }
      });

      totalsData.push(branchTotals);
    });

    // Add grand total row
    totalsData.push(grandTotals);

    // Create totals worksheet
    const totalsWorksheet = XLSX.utils.json_to_sheet(totalsData);
    XLSX.utils.book_append_sheet(workbook, totalsWorksheet, 'TOTALS');

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // Create response with Excel file
    const response = new NextResponse(excelBuffer);
    response.headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const filenamePrefix = nonPaidOnly ? 'non-paid-salary-report' : 'salary-report';
    response.headers.set('Content-Disposition', `attachment; filename=${filenamePrefix}-${month}-${year}.xlsx`);

    return response;
  } catch (error) {
    console.error('Error generating salary report:', error);
    return NextResponse.json({ error: 'Failed to generate salary report' }, { status: 500 });
  }
} 
