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

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const totalDaysInMonth = endDate.getDate();
    
    // If viewing current month, only count days up to today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
    const daysToCount = isCurrentMonth ? today.getDate() : totalDaysInMonth;

    // Build where clause for employees
    const employeeWhereClause: Prisma.UserWhereInput = {
      status: "ACTIVE",
      role: "EMPLOYEE",
      ...(branchFilter !== "ALL" && {
        branch: {
          name: branchFilter,
        },
      }),
    };

    // Get all active employees
    const employees = await prisma.user.findMany({
      where: employeeWhereClause,
      select: {
        id: true,
        name: true,
        branch: {
          select: {
            name: true,
          },
        },
      },
    });

    // Get all attendance records for the month
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
        user: {
          status: "ACTIVE",
          role: "EMPLOYEE",
          ...(branchFilter !== "ALL" && {
            branch: {
              name: branchFilter,
            },
          }),
        },
        status: "APPROVED", // Only count approved attendance
      },
      select: {
        userId: true,
        date: true,
        isPresent: true,
        isHalfDay: true,
        overtime: true,
        user: {
          select: {
            branch: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Calculate per-employee statistics
    const employeeStats = new Map<string, {
      presentDays: number;
      absentDays: number;
      halfDays: number;
      overtimeDays: number;
      branch: string;
    }>();

    // Initialize all employees with 0 stats
    employees.forEach((emp) => {
      employeeStats.set(emp.id, {
        presentDays: 0,
        absentDays: 0,
        halfDays: 0,
        overtimeDays: 0,
        branch: emp.branch?.name || "Unknown",
      });
    });

    // Calculate stats from attendance records
    attendanceRecords.forEach((record) => {
      const stats = employeeStats.get(record.userId);
      if (stats) {
        if (record.isPresent) {
          if (record.isHalfDay) {
            stats.presentDays += 0.5;
            stats.halfDays += 1;
          } else {
            stats.presentDays += 1;
          }
          if (record.overtime) {
            stats.overtimeDays += 1;
          }
        } else {
          stats.absentDays += 1;
        }
      }
    });

    // Calculate aggregate statistics
    let totalPresentDays = 0;
    let totalAbsentDays = 0;
    let totalHalfDays = 0;
    let totalOvertimeDays = 0;
    const totalEmployees = employees.length;
    const totalWorkingDays = totalEmployees * daysToCount;

    employeeStats.forEach((stats) => {
      totalPresentDays += stats.presentDays;
      totalAbsentDays += stats.absentDays;
      totalHalfDays += stats.halfDays;
      totalOvertimeDays += stats.overtimeDays;
    });

    // Calculate average attendance rate (present days / total possible days)
    const averageAttendanceRate = totalWorkingDays > 0 
      ? (totalPresentDays / totalWorkingDays) * 100 
      : 0;

    // Calculate average present days per employee
    const avgPresentDaysPerEmployee = totalEmployees > 0 
      ? totalPresentDays / totalEmployees 
      : 0;

    // Group by branch
    const branchMap = new Map<string, {
      employees: number;
      presentDays: number;
      absentDays: number;
      halfDays: number;
      overtimeDays: number;
    }>();

    employeeStats.forEach((stats) => {
      const branchName = stats.branch;
      if (!branchMap.has(branchName)) {
        branchMap.set(branchName, {
          employees: 0,
          presentDays: 0,
          absentDays: 0,
          halfDays: 0,
          overtimeDays: 0,
        });
      }
      const branchStats = branchMap.get(branchName)!;
      branchStats.employees += 1;
      branchStats.presentDays += stats.presentDays;
      branchStats.absentDays += stats.absentDays;
      branchStats.halfDays += stats.halfDays;
      branchStats.overtimeDays += stats.overtimeDays;
    });

    const attendanceByBranch = Array.from(branchMap.entries()).map(([branch, stats]) => {
      const totalPossibleDays = stats.employees * daysToCount;
      const attendanceRate = totalPossibleDays > 0 
        ? (stats.presentDays / totalPossibleDays) * 100 
        : 0;
      const avgPresentDays = stats.employees > 0 
        ? stats.presentDays / stats.employees 
        : 0;

      return {
        branch,
        employees: stats.employees,
        presentDays: parseFloat(stats.presentDays.toFixed(1)),
        absentDays: stats.absentDays,
        halfDays: stats.halfDays,
        overtimeDays: stats.overtimeDays,
        attendanceRate: parseFloat(attendanceRate.toFixed(1)),
        avgPresentDays: parseFloat(avgPresentDays.toFixed(1)),
      };
    }).sort((a, b) => b.attendanceRate - a.attendanceRate);

    // Calculate daily attendance trend
    const dailyMap = new Map<string, { present: number; absent: number; total: number }>();
    
    // Initialize all days
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      dailyMap.set(dateStr, { present: 0, absent: 0, total: 0 });
    }

    // Count daily attendance
    attendanceRecords.forEach((record) => {
      const dateStr = record.date.toISOString().split("T")[0];
      if (dailyMap.has(dateStr)) {
        const dayStats = dailyMap.get(dateStr)!;
        dayStats.total += 1;
        if (record.isPresent && !record.isHalfDay) {
          dayStats.present += 1;
        } else if (!record.isPresent) {
          dayStats.absent += 1;
        }
      }
    });

    const attendanceTrend = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        present: stats.present,
        absent: stats.absent,
        total: stats.total,
        rate: stats.total > 0 ? parseFloat(((stats.present / stats.total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate top performers (employees with highest attendance)
    const topPerformers = Array.from(employeeStats.entries())
      .map(([employeeId, stats]) => {
        const employee = employees.find(e => e.id === employeeId);
        const attendanceRate = daysToCount > 0 
          ? (stats.presentDays / daysToCount) * 100 
          : 0;
        return {
          name: employee?.name || "Unknown",
          presentDays: parseFloat(stats.presentDays.toFixed(1)),
          absentDays: stats.absentDays,
          attendanceRate: parseFloat(attendanceRate.toFixed(1)),
        };
      })
      .sort((a, b) => b.attendanceRate - a.attendanceRate)
      .slice(0, 10);

    // Calculate employees with low attendance (below 80%)
    const lowAttendanceEmployees = Array.from(employeeStats.entries())
      .map(([employeeId, stats]) => {
        const employee = employees.find(e => e.id === employeeId);
        const attendanceRate = daysToCount > 0 
          ? (stats.presentDays / daysToCount) * 100 
          : 0;
        return {
          name: employee?.name || "Unknown",
          branch: stats.branch,
          presentDays: parseFloat(stats.presentDays.toFixed(1)),
          absentDays: stats.absentDays,
          attendanceRate: parseFloat(attendanceRate.toFixed(1)),
        };
      })
      .filter(emp => emp.attendanceRate < 80)
      .sort((a, b) => a.attendanceRate - b.attendanceRate)
      .slice(0, 10);

    return NextResponse.json({
      totalEmployees,
      totalDaysInMonth,
      daysToCount,
      isCurrentMonth,
      totalPresentDays: parseFloat(totalPresentDays.toFixed(1)),
      totalAbsentDays,
      totalHalfDays,
      totalOvertimeDays,
      averageAttendanceRate: parseFloat(averageAttendanceRate.toFixed(1)),
      avgPresentDaysPerEmployee: parseFloat(avgPresentDaysPerEmployee.toFixed(1)),
      attendanceByBranch,
      attendanceTrend,
      topPerformers,
      lowAttendanceEmployees,
    });
  } catch (error) {
    console.error("Error generating attendance report:", error);
    return NextResponse.json(
      { error: "Failed to generate attendance report" },
      { status: 500 }
    );
  }
}
