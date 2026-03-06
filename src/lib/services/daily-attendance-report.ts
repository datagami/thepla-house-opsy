import { prisma } from "@/lib/prisma";
import { sendEmail } from "./email";
import { startOfDay, endOfDay, format } from "date-fns";
import { logActivity } from "./activity-log";
import { ActivityType } from "@prisma/client";
import { sortBranchesForReport } from "@/lib/branch-order";

const RECIPIENT = "management@theplahouse.com";

export async function sendDailyAttendanceReport(options?: { previewOnly?: boolean }) {
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  const dateLabel = format(today, "dd MMM yyyy (EEEE)");

  // Fetch all branches
  const branches = await prisma.branch.findMany({
    select: { id: true, name: true },
  });
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const sortedBranchNames = sortBranchesForReport(branches.map((b) => b.name));

  // Fetch today's attendance
  const attendances = await prisma.attendance.findMany({
    where: {
      date: { gte: dayStart, lte: dayEnd },
    },
    include: {
      user: {
        select: { name: true, numId: true },
      },
    },
  });

  // Fetch total active employees per branch
  const activeUsers = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      branchId: { not: null },
    },
    select: { branchId: true },
  });

  const totalByBranch = new Map<string, number>();
  for (const u of activeUsers) {
    if (u.branchId) {
      totalByBranch.set(u.branchId, (totalByBranch.get(u.branchId) || 0) + 1);
    }
  }

  // Group attendance by branch
  type BranchStats = {
    present: number;
    halfDay: number;
    overtime: number;
    weeklyOff: number;
    wfh: number;
    pending: number;
    approved: number;
    rejected: number;
    absent: number;
    totalEmployees: number;
  };

  const branchStats = new Map<string, BranchStats>();

  for (const att of attendances) {
    const branchName = branchMap.get(att.branchId) || "Unknown";
    if (!branchStats.has(branchName)) {
      const branchId = att.branchId;
      branchStats.set(branchName, {
        present: 0,
        halfDay: 0,
        overtime: 0,
        weeklyOff: 0,
        wfh: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        absent: 0,
        totalEmployees: totalByBranch.get(branchId) || 0,
      });
    }

    const stats = branchStats.get(branchName)!;

    if (att.isPresent) stats.present++;
    if (att.isHalfDay) stats.halfDay++;
    if (att.overtime) stats.overtime++;
    if (att.isWeeklyOff) stats.weeklyOff++;
    if (att.isWorkFromHome) stats.wfh++;

    if (att.status === "PENDING_VERIFICATION") stats.pending++;
    else if (att.status === "APPROVED") stats.approved++;
    else if (att.status === "REJECTED") stats.rejected++;
  }

  // Calculate absent for each branch
  for (const [, stats] of branchStats) {
    stats.absent = Math.max(0, stats.totalEmployees - stats.present - stats.weeklyOff);
  }

  // Fetch branch transfers that happened today
  const branchTransfers = await prisma.activityLog.findMany({
    where: {
      activityType: "USER_BRANCH_ASSIGNED",
      createdAt: { gte: dayStart, lte: dayEnd },
    },
    include: {
      targetUser: {
        select: { name: true, numId: true },
      },
      user: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Overall totals
  const overallPresent = attendances.filter((a) => a.isPresent).length;
  const overallHalfDay = attendances.filter((a) => a.isHalfDay).length;
  const overallOvertime = attendances.filter((a) => a.overtime).length;
  const overallWeeklyOff = attendances.filter((a) => a.isWeeklyOff).length;
  const totalActiveEmployees = activeUsers.length;
  const overallAbsent = Math.max(0, totalActiveEmployees - overallPresent - overallWeeklyOff);
  const attendanceRate =
    totalActiveEmployees > 0
      ? Math.round((overallPresent / (totalActiveEmployees - overallWeeklyOff)) * 100)
      : 0;

  // Build email HTML
  let html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; margin: 0 auto; color: #333;">
      <div style="background: #1a1a2e; color: #fff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 20px;">Daily Attendance Report</h2>
        <p style="margin: 4px 0 0; opacity: 0.8; font-size: 14px;">${dateLabel}</p>
      </div>

      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px 24px; border-radius: 0 0 8px 8px;">

        <!-- Summary Cards -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 12px; background: #ecfdf5; border-radius: 6px; text-align: center; width: 25%;">
              <div style="font-size: 24px; font-weight: bold; color: #059669;">${overallPresent}</div>
              <div style="font-size: 12px; color: #065f46;">Present</div>
            </td>
            <td style="width: 8px;"></td>
            <td style="padding: 12px; background: #fef2f2; border-radius: 6px; text-align: center; width: 25%;">
              <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${overallAbsent}</div>
              <div style="font-size: 12px; color: #991b1b;">Absent</div>
            </td>
            <td style="width: 8px;"></td>
            <td style="padding: 12px; background: #eff6ff; border-radius: 6px; text-align: center; width: 25%;">
              <div style="font-size: 24px; font-weight: bold; color: #2563eb;">${overallHalfDay}</div>
              <div style="font-size: 12px; color: #1e40af;">Half Day</div>
            </td>
            <td style="width: 8px;"></td>
            <td style="padding: 12px; background: #fefce8; border-radius: 6px; text-align: center; width: 25%;">
              <div style="font-size: 24px; font-weight: bold; color: #ca8a04;">${attendanceRate}%</div>
              <div style="font-size: 12px; color: #854d0e;">Rate</div>
            </td>
          </tr>
        </table>

        <div style="font-size: 13px; color: #6b7280; margin-bottom: 16px;">
          Total: ${totalActiveEmployees} employees &middot; Weekly Off: ${overallWeeklyOff} &middot; Overtime: ${overallOvertime}
        </div>

        <!-- Branch-wise Breakdown -->
        <h3 style="font-size: 16px; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
          Branch-wise Attendance
        </h3>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="text-align: left; padding: 8px 10px; border-bottom: 1px solid #e5e7eb;">Branch</th>
              <th style="text-align: center; padding: 8px 6px; border-bottom: 1px solid #e5e7eb;">Total</th>
              <th style="text-align: center; padding: 8px 6px; border-bottom: 1px solid #e5e7eb;">Present</th>
              <th style="text-align: center; padding: 8px 6px; border-bottom: 1px solid #e5e7eb;">Absent</th>
              <th style="text-align: center; padding: 8px 6px; border-bottom: 1px solid #e5e7eb;">Half Day</th>
              <th style="text-align: center; padding: 8px 6px; border-bottom: 1px solid #e5e7eb;">OT</th>
              <th style="text-align: center; padding: 8px 6px; border-bottom: 1px solid #e5e7eb;">W.Off</th>
              <th style="text-align: center; padding: 8px 6px; border-bottom: 1px solid #e5e7eb;">Rate</th>
            </tr>
          </thead>
          <tbody>`;

  for (const branchName of sortedBranchNames) {
    const stats = branchStats.get(branchName);
    if (!stats) continue;

    const branchRate =
      stats.totalEmployees - stats.weeklyOff > 0
        ? Math.round((stats.present / (stats.totalEmployees - stats.weeklyOff)) * 100)
        : 0;
    const rateColor = branchRate >= 80 ? "#059669" : branchRate >= 60 ? "#ca8a04" : "#dc2626";

    html += `
            <tr>
              <td style="padding: 8px 10px; border-bottom: 1px solid #f3f4f6; font-weight: 500;">${branchName}</td>
              <td style="text-align: center; padding: 8px 6px; border-bottom: 1px solid #f3f4f6;">${stats.totalEmployees}</td>
              <td style="text-align: center; padding: 8px 6px; border-bottom: 1px solid #f3f4f6; color: #059669; font-weight: 600;">${stats.present}</td>
              <td style="text-align: center; padding: 8px 6px; border-bottom: 1px solid #f3f4f6; color: ${stats.absent > 0 ? "#dc2626" : "#6b7280"};">${stats.absent}</td>
              <td style="text-align: center; padding: 8px 6px; border-bottom: 1px solid #f3f4f6;">${stats.halfDay}</td>
              <td style="text-align: center; padding: 8px 6px; border-bottom: 1px solid #f3f4f6;">${stats.overtime}</td>
              <td style="text-align: center; padding: 8px 6px; border-bottom: 1px solid #f3f4f6;">${stats.weeklyOff}</td>
              <td style="text-align: center; padding: 8px 6px; border-bottom: 1px solid #f3f4f6; color: ${rateColor}; font-weight: 600;">${branchRate}%</td>
            </tr>`;
  }

  html += `
          </tbody>
        </table>`;

  // Branch Transfers section
  if (branchTransfers.length > 0) {
    html += `
        <h3 style="font-size: 16px; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
          Branch Transfers Today (${branchTransfers.length})
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="text-align: left; padding: 8px 10px; border-bottom: 1px solid #e5e7eb;">Employee</th>
              <th style="text-align: left; padding: 8px 10px; border-bottom: 1px solid #e5e7eb;">Transfer</th>
              <th style="text-align: left; padding: 8px 10px; border-bottom: 1px solid #e5e7eb;">By</th>
            </tr>
          </thead>
          <tbody>`;

    for (const transfer of branchTransfers) {
      let meta: { oldBranchId?: string; newBranchId?: string } = {};
      try {
        meta = transfer.metadata ? JSON.parse(transfer.metadata) : {};
      } catch { /* skip */ }

      const fromBranch = meta.oldBranchId ? branchMap.get(meta.oldBranchId) || "None" : "None";
      const toBranch = meta.newBranchId ? branchMap.get(meta.newBranchId) || "None" : "None";

      html += `
            <tr>
              <td style="padding: 8px 10px; border-bottom: 1px solid #f3f4f6;">${transfer.targetUser?.name || "Unknown"}</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #f3f4f6;">${fromBranch} → ${toBranch}</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #f3f4f6;">${transfer.user?.name || "System"}</td>
            </tr>`;
    }

    html += `
          </tbody>
        </table>`;
  }

  html += `
        <p style="margin-top: 24px; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px;">
          This report was generated automatically by Opsy at ${format(today, "hh:mm a")}.
          Log in to the dashboard for detailed analytics.
        </p>
      </div>
    </div>`;

  // Preview mode — return HTML without sending
  if (options?.previewOnly) {
    return {
      emailSent: false,
      html,
      date: dateLabel,
      stats: {
        present: overallPresent,
        absent: overallAbsent,
        halfDay: overallHalfDay,
        overtime: overallOvertime,
        totalEmployees: totalActiveEmployees,
        attendanceRate,
        branchTransfers: branchTransfers.length,
      },
    };
  }

  // Send email
  let emailSent = false;
  try {
    await sendEmail({
      to: RECIPIENT,
      subject: `Daily Attendance: ${overallPresent}/${totalActiveEmployees} Present (${attendanceRate}%) - ${format(today, "dd MMM")}`,
      html,
    });
    emailSent = true;
    console.log("Daily attendance report sent to", RECIPIENT);
  } catch (error) {
    console.error("Failed to send daily attendance report:", error);
    throw error;
  }

  // Log activity
  await logActivity({
    activityType: ActivityType.DAILY_ATTENDANCE_REPORT,
    description: `Daily attendance report sent. ${overallPresent}/${totalActiveEmployees} present (${attendanceRate}%). ${branchTransfers.length} branch transfers.`,
    metadata: {
      recipient: RECIPIENT,
      date: dateLabel,
      present: overallPresent,
      absent: overallAbsent,
      halfDay: overallHalfDay,
      overtime: overallOvertime,
      weeklyOff: overallWeeklyOff,
      totalEmployees: totalActiveEmployees,
      attendanceRate,
      branchTransfers: branchTransfers.length,
      automated: true,
    },
  });

  return {
    emailSent,
    date: dateLabel,
    stats: {
      present: overallPresent,
      absent: overallAbsent,
      halfDay: overallHalfDay,
      overtime: overallOvertime,
      totalEmployees: totalActiveEmployees,
      attendanceRate,
      branchTransfers: branchTransfers.length,
    },
  };
}
