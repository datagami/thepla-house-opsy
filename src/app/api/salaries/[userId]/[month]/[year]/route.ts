import {NextResponse} from "next/server";
import {auth} from "@/auth";
import {prisma} from "@/lib/prisma";
import {calculateSalary} from "@/lib/services/salary-calculator";

export async function POST(
  request: Request,
  {params}: { params: Promise<{ userId: string; month: string; year: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    // @ts-expect-error - session is not null
    const role = session?.user?.role;

    // Only HR and MANAGEMENT can generate salaries
    if (!["HR", "MANAGEMENT"].includes(role)) {
      return NextResponse.json({error: "Forbidden"}, {status: 403});
    }

    const {userId, month, year} = await params;
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    // Validate month and year
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12 || isNaN(yearNum)) {
      return NextResponse.json(
        {error: "Invalid month or year"},
        {status: 400}
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: {id: userId},
      include: {
        branch: true,
      },
    });

    if (!user) {
      return NextResponse.json({error: "User not found"}, {status: 404});
    }

    // Check if salary already exists for this month
    const existingSalary = await prisma.salary.findFirst({
      where: {
        userId,
        month: monthNum,
        year: yearNum,
      },
    });

    if (existingSalary) {
      return NextResponse.json(
        {error: "Salary already exists for this month"},
        {status: 400}
      );
    }

    // Calculate salary details
    const salaryDetails = await calculateSalary(userId, monthNum, yearNum);

    // Get pending advances and calculate suggested installments
    const pendingAdvances = await prisma.advancePayment.findMany({
      where: {
        userId,
        status: 'APPROVED',
        isSettled: false,
      },
      include: {
        installments: {
          where: {
            salary: {
              month: monthNum,
              year: yearNum,
            }
          }
        }
      }
    });

    // Create salary record with suggested advance deductions
    const salary = await prisma.$transaction(async (tx) => {
      // Create the salary record
      const salary = await tx.salary.create({
        data: {
          userId,
          month: monthNum,
          year: yearNum,
          baseSalary: salaryDetails.baseSalary,
          advanceDeduction: 0, // Will be updated when installments are approved
          overtimeBonus: salaryDetails.overtimeAmount,
          otherBonuses: salaryDetails.otherBonuses,
          deductions: 0,
          netSalary: salaryDetails.netSalary,
          presentDays: salaryDetails.presentDays,
          overtimeDays: salaryDetails.overtimeDays,
          halfDays: salaryDetails.halfDays,
          leavesEarned: salaryDetails.leavesEarned,
          leaveSalary: salaryDetails.leaveSalary,
          status: 'PENDING'
        }
      });

      // Create pending installments for each suggested deduction
      for (const advance of pendingAdvances) {
        // Skip if advance already has an installment for this month
        if (advance.installments.length > 0) continue;

        // Calculate suggested amount
        const suggestedAmount = Math.min(
          advance.emiAmount,
          advance.remainingAmount
        );

        if (suggestedAmount > 0) {
          await tx.advancePaymentInstallment.create({
            data: {
              userId,
              advanceId: advance.id,
              salaryId: salary.id,
              amountPaid: suggestedAmount,
              status: 'PENDING',
              paidAt: null
            }
          });
        }
      }

      return salary;
    });

    return NextResponse.json(salary);
  } catch (error) {
    console.error("Error generating salary:", error);
    return NextResponse.json(
      {error: "Failed to generate salary"},
      {status: 500}
    );
  }
}

export async function DELETE(
  request: Request,
  {params}: { params: Promise<{ userId: string; month: string; year: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    // @ts-expect-error - session is not null
    const role = session?.user?.role;

    // Only HR and MANAGEMENT can delete salaries
    if (!["HR", "MANAGEMENT"].includes(role)) {
      return NextResponse.json({error: "Forbidden"}, {status: 403});
    }

    const {userId, month, year} = await params;
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    // Validate month and year
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12 || isNaN(yearNum)) {
      return NextResponse.json(
        {error: "Invalid month or year"},
        {status: 400}
      );
    }

    // Find and delete the salary
    const salary = await prisma.salary.findFirst({
      where: {
        userId,
        month: monthNum,
        year: yearNum,
      },
    });

    if (!salary) {
      return NextResponse.json({error: "Salary not found"}, {status: 404});
    }

    // Delete the salary and its installments in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete all installments first
      await tx.advancePaymentInstallment.deleteMany({
        where: {
          salaryId: salary.id
        }
      });

      // Then delete the salary
      await tx.salary.delete({
        where: {id: salary.id}
      });
    });

    return NextResponse.json({message: "Salary deleted successfully"});
  } catch (error) {
    console.error("Error deleting salary:", error);
    return NextResponse.json(
      {error: "Failed to delete salary"},
      {status: 500}
    );
  }
} 
