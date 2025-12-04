import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session || !["HR", "MANAGEMENT", "BRANCH_MANAGER"].includes(session.user.role)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get("month") || new Date().getMonth().toString());
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const branchFilter = searchParams.get("branch") || "ALL";

    // @ts-expect-error - branchId is not in the User type
    const userBranchId = session.user.branchId;
    const isBranchManager = session.user.role === "BRANCH_MANAGER";

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Build where clause based on role
    const whereClause: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
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

    // Get all attendance records for the month
    const attendanceRecords = await prisma.attendance.findMany({
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

    // Get unique employees for the month
    const uniqueEmployees = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        ...(isBranchManager && { branchId: userBranchId }),
        ...(branchFilter !== "ALL" && !isBranchManager && {
          branch: {
            name: branchFilter,
          },
        }),
      },
      include: {
        branch: {
          select: {
            name: true,
          },
        },
      },
    });

    // Calculate statistics
    const totalEmployees = uniqueEmployees.length;
    const presentCount = attendanceRecords.filter((a) => a.isPresent && !a.isHalfDay).length;
    const absentCount = attendanceRecords.filter((a) => !a.isPresent).length;
    const halfDayCount = attendanceRecords.filter((a) => a.isHalfDay).length;
    const overtimeCount = attendanceRecords.filter((a) => a.overtime).length;

    // Group by branch
    const branchMap = new Map<string, { present: number; absent: number; total: number }>();
    
    uniqueEmployees.forEach((emp) => {
      const branchName = emp.branch?.name || "Unknown";
      if (!branchMap.has(branchName)) {
        branchMap.set(branchName, { present: 0, absent: 0, total: 0 });
      }
      branchMap.get(branchName)!.total += 1;
    });

    attendanceRecords.forEach((record) => {
      const branchName = record.user.branch?.name || "Unknown";
      if (branchMap.has(branchName)) {
        if (record.isPresent && !record.isHalfDay) {
          branchMap.get(branchName)!.present += 1;
        } else if (!record.isPresent) {
          branchMap.get(branchName)!.absent += 1;
        }
      }
    });

    const attendanceByBranch = Array.from(branchMap.entries()).map(([branch, stats]) => ({
      branch,
      present: stats.present,
      absent: stats.absent,
      total: stats.total,
      percentage: stats.total > 0 ? (stats.present / stats.total) * 100 : 0,
    }));

    // Calculate daily attendance trend
    const dailyMap = new Map<string, { present: number; absent: number }>();
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      dailyMap.set(dateStr, { present: 0, absent: 0 });
    }

    attendanceRecords.forEach((record) => {
      const dateStr = record.date.toISOString().split("T")[0];
      if (dailyMap.has(dateStr)) {
        if (record.isPresent && !record.isHalfDay) {
          dailyMap.get(dateStr)!.present += 1;
        } else if (!record.isPresent) {
          dailyMap.get(dateStr)!.absent += 1;
        }
      }
    });

    const attendanceTrend = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        present: stats.present,
        absent: stats.absent,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const averageAttendance = totalEmployees > 0 ? (presentCount / (totalEmployees * endDate.getDate())) * 100 : 0;

    return NextResponse.json({
      totalEmployees,
      presentCount,
      absentCount,
      halfDayCount,
      overtimeCount,
      averageAttendance: parseFloat(averageAttendance.toFixed(2)),
      attendanceByBranch,
      attendanceTrend,
    });
  } catch (error) {
    console.error("Error generating attendance report:", error);
    return NextResponse.json(
      { error: "Failed to generate attendance report" },
      { status: 500 }
    );
  }
}

