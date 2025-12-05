import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session?.user || !["HR", "MANAGEMENT"].includes(session.user.role)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get("month") || new Date().getMonth().toString());
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const branchFilter = searchParams.get("branch") || "ALL";

    // @ts-expect-error - branchId is not in the User type
    const userBranchId = session.user.branchId;
    // @ts-expect-error - role is not in the User type
    const isBranchManager = session.user.role === "BRANCH_MANAGER";

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Build where clause
    const whereClause: Prisma.LeaveRequestWhereInput = {
      OR: [
        {
          startDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        {
          endDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        {
          AND: [
            { startDate: { lte: startDate } },
            { endDate: { gte: endDate } },
          ],
        },
      ],
      user: {
        status: "ACTIVE",
        ...(isBranchManager && { branchId: userBranchId }),
        ...(branchFilter !== "ALL" && !isBranchManager && {
          branch: {
            name: branchFilter,
          },
        }),
      },
    };

    // Get all leave requests for the month
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: whereClause,
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

    // Calculate statistics
    const totalRequests = leaveRequests.length;
    const approved = leaveRequests.filter((lr) => lr.status === "APPROVED").length;
    const rejected = leaveRequests.filter((lr) => lr.status === "REJECTED").length;
    const pending = leaveRequests.filter((lr) => lr.status === "PENDING").length;

    // Group by leave type
    const typeMap = new Map<string, { count: number; days: number }>();
    leaveRequests.forEach((lr) => {
      const type = lr.leaveType;
      const days = Math.ceil(
        (lr.endDate.getTime() - lr.startDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

      if (!typeMap.has(type)) {
        typeMap.set(type, { count: 0, days: 0 });
      }
      const stats = typeMap.get(type)!;
      stats.count += 1;
      stats.days += days;
    });

    const leaveByType = Array.from(typeMap.entries()).map(([type, stats]) => ({
      type,
      count: stats.count,
      days: stats.days,
    }));

    // Calculate monthly trend (last 6 months)
    const trendData = [];
    for (let i = 5; i >= 0; i--) {
      const trendMonth = month - i;
      const trendYear = trendMonth <= 0 ? year - 1 : year;
      const adjustedMonth = trendMonth <= 0 ? trendMonth + 12 : trendMonth;

      const trendStart = new Date(trendYear, adjustedMonth - 1, 1);
      const trendEnd = new Date(trendYear, adjustedMonth, 0);

      const trendRequests = await prisma.leaveRequest.count({
        where: {
          OR: [
            {
              startDate: {
                gte: trendStart,
                lte: trendEnd,
              },
            },
            {
              endDate: {
                gte: trendStart,
                lte: trendEnd,
              },
            },
          ],
          user: {
            status: "ACTIVE",
            ...(isBranchManager && { branchId: userBranchId }),
            ...(branchFilter !== "ALL" && !isBranchManager && {
              branch: {
                name: branchFilter,
              },
            }),
          },
        },
      });

      const trendApproved = await prisma.leaveRequest.count({
        where: {
          status: "APPROVED",
          OR: [
            {
              startDate: {
                gte: trendStart,
                lte: trendEnd,
              },
            },
            {
              endDate: {
                gte: trendStart,
                lte: trendEnd,
              },
            },
          ],
          user: {
            status: "ACTIVE",
            ...(isBranchManager && { branchId: userBranchId }),
            ...(branchFilter !== "ALL" && !isBranchManager && {
              branch: {
                name: branchFilter,
              },
            }),
          },
        },
      });

      trendData.push({
        month: `${adjustedMonth}/${trendYear}`,
        requests: trendRequests,
        approved: trendApproved,
      });
    }

    // Top employees by leave days
    const employeeLeaveMap = new Map<string, { name: string; days: number; type: string }>();
    leaveRequests
      .filter((lr) => lr.status === "APPROVED")
      .forEach((lr) => {
        const days = Math.ceil(
          (lr.endDate.getTime() - lr.startDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
        const key = lr.userId;
        if (!employeeLeaveMap.has(key)) {
          employeeLeaveMap.set(key, {
            name: lr.user.name || "Unknown",
            days: 0,
            type: lr.leaveType,
          });
        }
        employeeLeaveMap.get(key)!.days += days;
      });

    const topEmployees = Array.from(employeeLeaveMap.values())
      .sort((a, b) => b.days - a.days)
      .slice(0, 10);

    return NextResponse.json({
      totalRequests,
      approved,
      rejected,
      pending,
      leaveByType,
      leaveTrend: trendData,
      topEmployees,
    });
  } catch (error) {
    console.error("Error generating leave report:", error);
    return NextResponse.json(
      { error: "Failed to generate leave report" },
      { status: 500 }
    );
  }
}

