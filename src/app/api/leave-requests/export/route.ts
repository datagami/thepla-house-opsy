import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import * as XLSX from "xlsx";
import { format, differenceInDays } from "date-fns";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // @ts-expect-error - role is not in the User type
    const userRole = session.user.role;
    const isHROrManagement = ["HR", "MANAGEMENT"].includes(userRole);

    // Only HR and MANAGEMENT can export reports
    if (!isHROrManagement) {
      return NextResponse.json(
        { error: "Unauthorized - Only HR and Management can export reports" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const branchId = searchParams.get("branchId");
    const status = searchParams.get("status");
    const leaveType = searchParams.get("leaveType");

    // Build where clause
    const where: any = {};

    // Filter by date range if month and year are provided
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      
      where.OR = [
        {
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: startDate } }
          ]
        }
      ];
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (leaveType && leaveType !== "ALL") {
      where.leaveType = leaveType;
    }

    if (branchId && branchId !== "ALL") {
      where.user = {
        branchId: branchId,
      };
    }

    // Fetch all leave requests with related data
    const allLeaveRequests = await prisma.leaveRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            numId: true,
            branch: {
              select: {
                name: true,
              },
            },
            department: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Summary - Grouped by user
    const userLeaveMap = new Map<
      string,
      {
        empNo: number;
        name: string;
        branch: string;
        department: string;
        totalLeaveDays: number;
        casualLeaves: number;
        sickLeaves: number;
        annualLeaves: number;
        unpaidLeaves: number;
        otherLeaves: number;
        pendingRequests: number;
        approvedRequests: number;
        rejectedRequests: number;
      }
    >();

    allLeaveRequests.forEach((leave) => {
      const userId = leave.userId;
      const days = differenceInDays(new Date(leave.endDate), new Date(leave.startDate)) + 1;

      if (!userLeaveMap.has(userId)) {
        userLeaveMap.set(userId, {
          empNo: leave.user.numId,
          name: leave.user.name ?? "Unknown",
          branch: leave.user.branch?.name ?? "N/A",
          department: leave.user.department?.name ?? "N/A",
          totalLeaveDays: 0,
          casualLeaves: 0,
          sickLeaves: 0,
          annualLeaves: 0,
          unpaidLeaves: 0,
          otherLeaves: 0,
          pendingRequests: 0,
          approvedRequests: 0,
          rejectedRequests: 0,
        });
      }

      const userStats = userLeaveMap.get(userId)!;
      
      // Only count approved leaves for leave days calculation
      if (leave.status === "APPROVED") {
        userStats.totalLeaveDays += days;
        
        switch (leave.leaveType) {
          case "CASUAL":
            userStats.casualLeaves += days;
            break;
          case "SICK":
            userStats.sickLeaves += days;
            break;
          case "ANNUAL":
            userStats.annualLeaves += days;
            break;
          case "UNPAID":
            userStats.unpaidLeaves += days;
            break;
          case "OTHER":
            userStats.otherLeaves += days;
            break;
        }
      }

      // Count requests by status
      switch (leave.status) {
        case "PENDING":
          userStats.pendingRequests += 1;
          break;
        case "APPROVED":
          userStats.approvedRequests += 1;
          break;
        case "REJECTED":
          userStats.rejectedRequests += 1;
          break;
      }
    });

    const summaryData = Array.from(userLeaveMap.values())
      .sort((a, b) => b.totalLeaveDays - a.totalLeaveDays)
      .map((user) => ({
        "Employee Number": user.empNo,
        "Employee Name": user.name,
        Branch: user.branch,
        Department: user.department,
        "Total Leave Days": user.totalLeaveDays,
        "Casual Leaves": user.casualLeaves,
        "Sick Leaves": user.sickLeaves,
        "Annual Leaves": user.annualLeaves,
        "Unpaid Leaves": user.unpaidLeaves,
        "Other Leaves": user.otherLeaves,
        "Pending Requests": user.pendingRequests,
        "Approved Requests": user.approvedRequests,
        "Rejected Requests": user.rejectedRequests,
      }));

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    // Sheet 2: All Leave Requests
    const leaveRequestsData = allLeaveRequests.map((leave) => {
      const days = differenceInDays(new Date(leave.endDate), new Date(leave.startDate)) + 1;
      
      return {
        "Employee Number": leave.user.numId,
        "Employee Name": leave.user.name ?? "Unknown",
        Branch: leave.user.branch?.name ?? "N/A",
        Department: leave.user.department?.name ?? "N/A",
        "Leave ID": leave.numId,
        "Leave Type": leave.leaveType,
        "Start Date": format(new Date(leave.startDate), "yyyy-MM-dd"),
        "End Date": format(new Date(leave.endDate), "yyyy-MM-dd"),
        Days: days,
        Reason: leave.reason ?? "N/A",
        Status: leave.status,
        "Requested Date": format(new Date(leave.createdAt), "yyyy-MM-dd"),
        "Last Updated": format(new Date(leave.updatedAt), "yyyy-MM-dd"),
      };
    });

    const leaveRequestsSheet = XLSX.utils.json_to_sheet(leaveRequestsData);
    XLSX.utils.book_append_sheet(workbook, leaveRequestsSheet, "All Leave Requests");

    // Sheet 3: Leave Statistics
    const statsData: any[] = [];

    // Statistics header
    statsData.push({ "Statistic Type": "LEAVE BY TYPE" });

    // By Type
    const typeStats = new Map<string, { count: number; days: number }>();
    allLeaveRequests.forEach((leave) => {
      if (leave.status === "APPROVED") {
        const days = differenceInDays(new Date(leave.endDate), new Date(leave.startDate)) + 1;
        const current = typeStats.get(leave.leaveType) || { count: 0, days: 0 };
        current.count += 1;
        current.days += days;
        typeStats.set(leave.leaveType, current);
      }
    });

    typeStats.forEach((stats, type) => {
      statsData.push({
        "Statistic Type": type,
        Count: stats.count,
        "Total Days": stats.days,
      });
    });

    // Separator
    statsData.push({ "Statistic Type": "" });
    statsData.push({ "Statistic Type": "LEAVE BY STATUS" });

    // By Status
    const statusStats = new Map<string, number>();
    allLeaveRequests.forEach((leave) => {
      statusStats.set(leave.status, (statusStats.get(leave.status) || 0) + 1);
    });

    statusStats.forEach((count, status) => {
      statsData.push({
        "Statistic Type": status,
        Count: count,
      });
    });

    // Separator
    statsData.push({ "Statistic Type": "" });
    statsData.push({ "Statistic Type": "MONTHLY BREAKDOWN" });

    // By Month
    const monthStats = new Map<string, { total: number; approved: number; rejected: number; pending: number }>();
    allLeaveRequests.forEach((leave) => {
      const monthKey = format(new Date(leave.startDate), "yyyy-MM");
      const current = monthStats.get(monthKey) || { total: 0, approved: 0, rejected: 0, pending: 0 };
      current.total += 1;
      
      switch (leave.status) {
        case "APPROVED":
          current.approved += 1;
          break;
        case "REJECTED":
          current.rejected += 1;
          break;
        case "PENDING":
          current.pending += 1;
          break;
      }
      
      monthStats.set(monthKey, current);
    });

    Array.from(monthStats.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([month, stats]) => {
        statsData.push({
          "Statistic Type": format(new Date(month + "-01"), "MMMM yyyy"),
          "Total Requests": stats.total,
          Approved: stats.approved,
          Rejected: stats.rejected,
          Pending: stats.pending,
        });
      });

    const statsSheet = XLSX.utils.json_to_sheet(statsData);
    XLSX.utils.book_append_sheet(workbook, statsSheet, "Statistics");

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    });

    // Create response with Excel file
    const response = new NextResponse(excelBuffer);
    response.headers.set(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    response.headers.set(
      "Content-Disposition",
      `attachment; filename=leave-requests-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`
    );

    return response;
  } catch (error) {
    console.error("Error generating leave requests report:", error);
    return NextResponse.json(
      { error: "Failed to generate leave requests report" },
      { status: 500 }
    );
  }
}
