import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logEntityActivity } from "@/lib/services/activity-log";
import { ActivityType, Prisma } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const session = await auth();

    // @ts-expect-error - role is not in the User type
    if (!session || !["HR", "MANAGEMENT"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { attendanceIds, date } = await req.json();

    // @ts-expect-error - id is not in the User type
    const verifierId = session.user.id;
    
    if (!verifierId) {
      return NextResponse.json(
        { error: "User ID not found in session" },
        { status: 401 }
      );
    }

    // Verify the verifier user exists
    const verifier = await prisma.user.findUnique({
      where: { id: verifierId },
      select: { id: true },
    });

    if (!verifier) {
      return NextResponse.json(
        { error: "Verifier user not found" },
        { status: 401 }
      );
    }

    // If attendanceIds are provided, approve those specific records
    // Otherwise, approve all pending verification records for the date that have been submitted
    const whereClause: Prisma.AttendanceWhereInput = {
      status: "PENDING_VERIFICATION",
      ...(attendanceIds && Array.isArray(attendanceIds) && attendanceIds.length > 0
        ? { id: { in: attendanceIds } }
        : date
        ? (() => {
            const attendanceDate = new Date(date);
            attendanceDate.setHours(0, 0, 0, 0);
            const nextDay = new Date(attendanceDate);
            nextDay.setDate(nextDay.getDate() + 1);
            return {
              date: {
                gte: attendanceDate,
                lt: nextDay,
              },
            };
          })()
        : null),
    };

    if (!attendanceIds && !date) {
      return NextResponse.json(
        { error: "Either attendanceIds or date must be provided" },
        { status: 400 }
      );
    }

    // Get attendance records to approve
    const attendanceRecords = await prisma.attendance.findMany({
      where: whereClause,
      select: {
        id: true,
        userId: true,
        date: true,
      },
    });

    if (attendanceRecords.length === 0) {
      return NextResponse.json(
        { error: "No pending attendance records found to approve" },
        { status: 404 }
      );
    }

    // Check salary status for all records
    const attendanceDates = [...new Set(attendanceRecords.map(a => a.date))];
    const salaryChecks = await Promise.all(
      attendanceDates.map(async (attendanceDate) => {
        const date = new Date(attendanceDate);
        const salaries = await prisma.salary.findMany({
          where: {
            userId: { in: attendanceRecords.map(a => a.userId) },
            month: date.getMonth() + 1,
            year: date.getFullYear(),
            status: {
              in: ['PENDING', 'PROCESSING']
            }
          },
          select: {
            id: true,
            userId: true,
            status: true,
            month: true,
            year: true,
          }
        });
        return salaries;
      })
    );

    const salariesToUpdate = salaryChecks.flat().filter(s => s.status === 'PENDING');

    // Bulk approve all attendance records
    const result = await prisma.attendance.updateMany({
      where: whereClause,
      data: {
        status: "APPROVED",
        verifiedById: verifierId,
        verifiedAt: new Date(),
        verificationNote: "Bulk approved by HR",
      },
    });

    // Recalculate salaries if needed
    if (salariesToUpdate.length > 0) {
      const { calculateSalary } = await import('@/lib/services/salary-calculator');
      
      for (const salary of salariesToUpdate) {
        const salaryDetails = await calculateSalary(salary.userId, salary.month, salary.year);
        
        await prisma.salary.update({
          where: { id: salary.id },
          data: {
            presentDays: salaryDetails.presentDays,
            overtimeDays: salaryDetails.overtimeDays,
            halfDays: salaryDetails.halfDays,
            leavesEarned: salaryDetails.leavesEarned,
            leaveSalary: salaryDetails.leaveSalary,
            netSalary: salaryDetails.netSalary
          }
        });
      }
    }

    // Log bulk approval activity
    await logEntityActivity(
      ActivityType.ATTENDANCE_VERIFIED,
      verifierId,
      "Attendance",
      attendanceRecords[0]?.id || "bulk",
      `Bulk approved ${result.count} attendance records`,
      {
        count: result.count,
        attendanceIds: attendanceRecords.map(a => a.id),
        date: date || "multiple dates",
      },
      req
    );

    return NextResponse.json({
      message: `Successfully approved ${result.count} attendance records`,
      count: result.count,
    });
  } catch (error) {
    console.error("Error bulk approving attendance:", error);
    return NextResponse.json(
      { error: "Failed to bulk approve attendance" },
      { status: 500 }
    );
  }
}
