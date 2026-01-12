import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import * as XLSX from 'xlsx';
import { calculateNetSalaryFromObject } from '@/lib/services/salary-calculator';
import { Salary } from '@/models/models';

export async function POST(req: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { year, month } = await req.json();

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and month are required' }, { status: 400 });
    }

    // Get all salaries for the given month and year (all statuses)
    const salaries = await prisma.salary.findMany({
      where: {
        month,
        year,
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
    }) as Salary[];

    if (salaries.length === 0) {
      return NextResponse.json(
        { error: 'No salaries found for the given month' },
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

    // Create a sheet for each branch
    Object.entries(salariesByBranch).forEach(([branch, branchSalaries]) => {
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
          "Net salary": netSalary,
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
      "salary": 0,
      "total salary": 0,
      "Paid Salary": 0,
      "Unpaid Salary": 0,
      "Status": "",
      "Remark": ""
    };

    // Calculate branch totals and grand totals
    Object.entries(salariesByBranch).forEach(([branch, branchSalaries]) => {
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
        "salary": 0,
        "total salary": 0,
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

        // Check if salary is paid
        const isPaid = salary.paidAt !== null || salary.status?.toUpperCase() === "PAID";

        branchTotals["Basic Salary"] += salary.baseSalary;
        branchTotals["no of present"] += salary.presentDays;
        branchTotals["leaves earned"] += salary.leavesEarned;
        branchTotals["no of OT"] += salary.overtimeDays;
        branchTotals["Advance"] += totalAdvanceDeductions;
        branchTotals["leave salary"] += leaveSalary;
        branchTotals["OT salary"] += overtimeSalary;
        branchTotals["salary"] += presentDaysSalary + overtimeSalary + leaveSalary;
        branchTotals["total salary"] += netSalary;

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
        grandTotals["salary"] += presentDaysSalary + overtimeSalary + leaveSalary;
        grandTotals["total salary"] += netSalary;

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
    response.headers.set('Content-Disposition', `attachment; filename=salary-report-${month}-${year}.xlsx`);

    return response;
  } catch (error) {
    console.error('Error generating salary report:', error);
    return NextResponse.json({ error: 'Failed to generate salary report' }, { status: 500 });
  }
} 
