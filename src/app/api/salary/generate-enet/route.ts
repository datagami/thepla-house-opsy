import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { calculateNetSalaryFromObject } from '@/lib/services/salary-calculator';
import { SalaryStatus, ActivityType } from '@prisma/client';
import { Salary } from '@/models/models';
import { logEntityActivity } from '@/lib/services/activity-log';
export async function POST(req: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session?.user || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const sessionUserId = session.user.id!;

    const { year, month } = await req.json();

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and month are required' }, { status: 400 });
    }

    // Get all processing salaries for the given month and year
    const salaries = await prisma.salary.findMany({
      where: {
        month,
        year,
        status: 'PROCESSING' as SalaryStatus
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            numId: true,
            bankAccountNo: true,
            bankIfscCode: true,
            email: true,
            branch: true
          }
        },
        installments: true
      }
    }) as Salary[];

    if (salaries.length === 0) {
      return NextResponse.json(
        { error: 'No processing salaries found for the given month' },
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

    // Create a sheet for each branch
    Object.entries(salariesByBranch).forEach(([branch, branchSalaries]) => {
      // Generate ENET file content for this branch
      const enetData = branchSalaries.map((salary, index) => {
        const rowData = {
          "Transaction Type": "N",
          "Beneficiary Code": index + 1,
          "Beneficiary Account Number": salary.user.bankAccountNo || "",
          "Transaction Amount": calculateNetSalaryFromObject(salary),
          "Beneficiary Name": `${salary.user.numId} - ${salary.user.name}`,
          "Unnamed: 5": "",
          "Unnamed: 6": "",
          "Unnamed: 7": "",
          "Unnamed: 8": "",
          "Unnamed: 9": "",
          "Unnamed: 10": "",
          "Unnamed: 11": "",
          "Unnamed: 12": "",
          "Customer Reference Number": `Salary ${format(new Date(year, month - 1), 'MMM yyyy')}`,
          "Unnamed: 14": "",
          "Unnamed: 15": "",
          "Unnamed: 16": "",
          "Unnamed: 17": "",
          "Unnamed: 18": "",
          "Unnamed: 19": "",
          "Unnamed: 20": "",
          "Unnamed: 21": "",
          "VALUE DATE": format(new Date(), 'dd/MM/yyyy'),
          "Unnamed: 23": "",
          "IFSC Code": salary.user.bankIfscCode || "",
          "Unnamed: 25": "",
          "Unnamed: 26": "",
          "Beneficiary email id": salary.user.email || ""
        };

        // Create concatenated string for the last column
        const concatenatedValues = Object.values(rowData).join(',');

        return {
          ...rowData,
          "COPY\n\n\n\n\nFROM\n\n\n\n\n\nHERE": concatenatedValues
        };
      });

      // Create worksheet for this branch
      const worksheet = XLSX.utils.json_to_sheet(enetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, branch);
    });

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // Log the ENET file download
    await logEntityActivity(
      ActivityType.ENET_FILE_DOWNLOADED,
      sessionUserId,
      "Salary",
      `enet-${month}-${year}`,
      `Downloaded ENET file for ${format(new Date(year, month - 1), 'MMMM yyyy')} - ${salaries.length} salaries`,
      { month, year, salaryCount: salaries.length, branches: Object.keys(salariesByBranch) },
      req
    );

    // Create response with Excel file
    const response = new NextResponse(excelBuffer);
    response.headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.headers.set('Content-Disposition', `attachment; filename=salary-enet-${month}-${year}.xlsx`);

    return response;
  } catch (error) {
    console.error('Error generating ENET file:', error);
    return NextResponse.json({ error: 'Failed to generate ENET file' }, { status: 500 });
  }
} 

