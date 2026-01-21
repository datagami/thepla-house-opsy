import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { calculateNetSalaryFromObject } from "@/lib/services/salary-calculator";

export async function GET(req: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session?.user || !["HR", "MANAGEMENT"].includes(session.user.role)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const month = parseInt(
      searchParams.get("month") || (new Date().getMonth() + 1).toString()
    );
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const branchFilter = searchParams.get("branch") || "ALL";

    // Get all salaries for the month
    const salaries = await prisma.salary.findMany({
      where: {
        month,
        year,
        ...(branchFilter !== "ALL" && {
          user: {
            branch: {
              name: branchFilter,
            },
          },
        }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            branch: {
              select: {
                name: true,
              },
            },
          },
        },
        installments: true,
        referrals: true,
      },
    });

    // Calculate total salary and paid/unpaid breakdown
    const totalSalary = salaries.reduce((sum, salary) => {
      return sum + calculateNetSalaryFromObject(salary as unknown as import('@/models/models').Salary);
    }, 0);

    const paidSalaries = salaries.filter(s => s.paidAt !== null || s.status?.toUpperCase() === "PAID");
    const unpaidSalaries = salaries.filter(s => s.paidAt === null && s.status?.toUpperCase() !== "PAID");

    const totalPaidSalary = paidSalaries.reduce((sum, salary) => {
      return sum + calculateNetSalaryFromObject(salary as unknown as import('@/models/models').Salary);
    }, 0);

    const totalUnpaidSalary = unpaidSalaries.reduce((sum, salary) => {
      return sum + calculateNetSalaryFromObject(salary as unknown as import('@/models/models').Salary);
    }, 0);

    // Get advance payments
    const advancePayments = await prisma.advancePayment.findMany({
      where: {
        createdAt: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month, 0),
        },
        ...(branchFilter !== "ALL" && {
          user: {
            branch: {
              name: branchFilter,
            },
          },
        }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            branch: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const totalAdvance = advancePayments.reduce((sum, advance) => sum + advance.amount, 0);

    // Calculate referral bonuses
    const totalReferralBonus = salaries.reduce((sum, salary) => {
      const referralBonus = salary.referrals
        ?.filter((r) => r.paidAt !== null)
        .reduce((refSum, ref) => refSum + ref.bonusAmount, 0) || 0;
      return sum + referralBonus;
    }, 0);

    // Group by branch
    const branchMap = new Map<
      string,
      { amount: number; employeeCount: number; employees: Set<string> }
    >();

    salaries.forEach((salary) => {
      const branchName = salary.user.branch?.name || "Unknown";
      if (!branchMap.has(branchName)) {
        branchMap.set(branchName, { amount: 0, employeeCount: 0, employees: new Set() });
      }
      const branchStats = branchMap.get(branchName)!;
      branchStats.amount += calculateNetSalaryFromObject(salary as unknown as import('@/models/models').Salary);
      branchStats.employees.add(salary.userId);
      branchStats.employeeCount = branchStats.employees.size;
    });

    const salaryByBranch = Array.from(branchMap.entries()).map(([branch, stats]) => ({
      branch,
      amount: stats.amount,
      employeeCount: stats.employeeCount,
    }));

    // Advance summary
    const advanceStatusMap = new Map<string, { count: number; amount: number }>();
    advancePayments.forEach((advance) => {
      const status = advance.status;
      if (!advanceStatusMap.has(status)) {
        advanceStatusMap.set(status, { count: 0, amount: 0 });
      }
      const stats = advanceStatusMap.get(status)!;
      stats.count += 1;
      stats.amount += advance.amount;
    });

    const advanceSummary = Array.from(advanceStatusMap.entries()).map(([status, stats]) => ({
      status,
      count: stats.count,
      amount: stats.amount,
    }));

    // Advance by branch
    const advanceBranchMap = new Map<
      string,
      { amount: number; count: number; employees: Set<string> }
    >();

    advancePayments.forEach((advance) => {
      const branchName = advance.user?.branch?.name || "Unknown";
      if (!advanceBranchMap.has(branchName)) {
        advanceBranchMap.set(branchName, { amount: 0, count: 0, employees: new Set() });
      }
      const stats = advanceBranchMap.get(branchName)!;
      stats.amount += advance.amount;
      stats.count += 1;
      stats.employees.add(advance.userId);
    });

    const advanceByBranch = Array.from(advanceBranchMap.entries())
      .map(([branch, stats]) => ({
        branch,
        amount: stats.amount,
        count: stats.count,
        employeeCount: stats.employees.size,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Advance by individual
    const advanceIndividualMap = new Map<
      string,
      { userId: string; name: string; branch: string; amount: number; count: number }
    >();

    advancePayments.forEach((advance) => {
      const userId = advance.userId;
      const name = advance.user?.name || "Unknown";
      const branchName = advance.user?.branch?.name || "Unknown";

      if (!advanceIndividualMap.has(userId)) {
        advanceIndividualMap.set(userId, { userId, name, branch: branchName, amount: 0, count: 0 });
      }

      const stats = advanceIndividualMap.get(userId)!;
      stats.amount += advance.amount;
      stats.count += 1;
    });

    const advanceByIndividual = Array.from(advanceIndividualMap.values()).sort(
      (a, b) => b.amount - a.amount
    );

    // Salary trend (last 6 months)
    const trendData = [];
    for (let i = 5; i >= 0; i--) {
      const trendMonth = month - i;
      const trendYear = trendMonth <= 0 ? year - 1 : year;
      const adjustedMonth = trendMonth <= 0 ? trendMonth + 12 : trendMonth;

      const trendSalaries = await prisma.salary.findMany({
        where: {
          month: adjustedMonth,
          year: trendYear,
          ...(branchFilter !== "ALL" && {
            user: {
              branch: {
                name: branchFilter,
              },
            },
          }),
        },
        include: {
          installments: true,
          referrals: true,
        },
      });

      const trendAmount = trendSalaries.reduce((sum, salary) => {
        return sum + calculateNetSalaryFromObject(salary as unknown as import('@/models/models').Salary);
      }, 0);

      trendData.push({
        month: `${adjustedMonth}/${trendYear}`,
        amount: trendAmount,
      });
    }

    return NextResponse.json({
      totalSalary,
      totalPaidSalary,
      totalUnpaidSalary,
      paidCount: paidSalaries.length,
      unpaidCount: unpaidSalaries.length,
      totalAdvance,
      totalReferralBonus,
      salaryByBranch,
      advanceSummary,
      advanceByBranch,
      advanceByIndividual,
      salaryTrend: trendData,
    });
  } catch (error) {
    console.error("Error generating financial report:", error);
    return NextResponse.json(
      { error: "Failed to generate financial report" },
      { status: 500 }
    );
  }
}

