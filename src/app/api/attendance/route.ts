import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logEntityActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const data = await req.json();
    
    // Get the user's current branch assignment and the creator's role
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { 
        branchId: true,
        role: true
      }
    });

    if (!user) {
      return new Response('User not found', { status: 404 });
    }

    // Check if the attendance date is in the past
    const attendanceDate = new Date(data.date);
    attendanceDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(attendanceDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // @ts-expect-error - role is not in the session type
    const creatorRole = session.user.role;
    const creatorId = (session.user as { id?: string }).id;

    if (!creatorId) {
      return new NextResponse("User ID not found in session", { status: 401 });
    }

    // Verify the creator user exists in the database
    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true },
    });

    if (!creator) {
      return new NextResponse("Creator user not found", { status: 401 });
    }

    // Check if user is trying to submit attendance for themselves
    const isSelfAttendance = creatorId === data.userId;

    // Define roles that can submit their own attendance
    const canSubmitSelfAttendance = ["HR", "MANAGEMENT", "SELF_ATTENDANCE", "BRANCH_MANAGER"].includes(user.role);

    // Validate attendance submission rules
    if (isSelfAttendance) {
      // Only allow self-attendance for specific roles
      if (!canSubmitSelfAttendance) {
        return NextResponse.json(
          { error: "Your role cannot submit self-attendance" },
          { status: 403 }
        );
      }

      // Only allow self-attendance for today
      if (attendanceDate.getTime() !== today.getTime()) {
        return NextResponse.json(
          { error: "You can only submit attendance for today" },
          { status: 403 }
        );
      }
    } else {
      // For non-self attendance, only HR and MANAGEMENT can create past attendance
      if (attendanceDate < today && !["HR", "MANAGEMENT"].includes(creatorRole)) {
        return NextResponse.json(
          { error: "Only HR and MANAGEMENT can create attendance for past dates" },
          { status: 403 }
        );
      }
    }

    // Check if salary exists for this month and its status
    const existingSalary = await prisma.salary.findFirst({
      where: {
        userId: data.userId,
        month: attendanceDate.getMonth() + 1,
        year: attendanceDate.getFullYear(),
        status: {
          in: ['PENDING', 'PROCESSING']
        }
      }
    });

    if (existingSalary?.status === 'PROCESSING') {
      throw new Error('Cannot edit attendance as salary is already in processing state');
    }

    // Set initial status based on who's creating the attendance
    let status = ["HR", "MANAGEMENT"].includes(creatorRole)
      ? "APPROVED" 
      : "PENDING_VERIFICATION";

    // Prevent duplicate attendance for the same user and day
    const duplicateAttendance = await prisma.attendance.findFirst({
      where: {
        userId: data.userId,
        date: {
          gte: attendanceDate,
          lt: nextDay,
        },
      },
      select: {
        id: true,
      },
    });

    if (duplicateAttendance) {
      return NextResponse.json(
        {
          error: "Attendance already exists for this user on the selected date",
          attendanceId: duplicateAttendance.id,
        },
        { status: 409 }
      );
    }

    // Get user's weekly off configuration
    const userWithWeeklyOff = await prisma.user.findUnique({
      where: { id: data.userId },
      select: {
        hasWeeklyOff: true,
        weeklyOffType: true,
        weeklyOffDay: true,
      },
    });

    // Validate weekly off if employee has weekly off configured
    let isWeeklyOff = data.isWeeklyOff || false;
    if (userWithWeeklyOff?.hasWeeklyOff) {
      if (userWithWeeklyOff.weeklyOffType === "FIXED") {
        // For fixed weekly off, check if the date matches the weekly off day
        const dayOfWeek = attendanceDate.getDay();
        isWeeklyOff = userWithWeeklyOff.weeklyOffDay === dayOfWeek;
      } else if (userWithWeeklyOff.weeklyOffType === "FLEXIBLE") {
        // For flexible weekly off, use the value from the request
        isWeeklyOff = data.isWeeklyOff || false;
        
        // Validate only one weekly off per week for flexible
        if (isWeeklyOff) {
          const weekStart = new Date(attendanceDate);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);

          const existingWeeklyOff = await prisma.attendance.findFirst({
            where: {
              userId: data.userId,
              date: {
                gte: weekStart,
                lte: weekEnd,
              },
              isWeeklyOff: true,
              NOT: {
                id: duplicateAttendance?.id,
              },
            },
          });

          if (existingWeeklyOff) {
            return NextResponse.json(
              { error: "Only one weekly off per week is allowed for flexible weekly off employees" },
              { status: 400 }
            );
          }
        }
      }
      
      // Weekly off days are automatically marked as present and approved
      if (isWeeklyOff) {
        data.isPresent = true;
        status = "APPROVED";
      }
    }

    // Create attendance with the user's current branch
    const attendance = await prisma.attendance.create({
      data: {
        date: attendanceDate,
        isPresent: data.isPresent,
        isHalfDay: data.isHalfDay,
        overtime: data.overtime,
        isWeeklyOff: isWeeklyOff,
        checkIn: data.checkIn || null,
        checkOut: data.checkOut || null,
        shift1: data.shift1 || false,
        shift2: data.shift2 || false,
        shift3: data.shift3 || false,
        notes: data.notes || null,
        userId: data.userId,
        branchId: user.branchId!,
        status,
        // If HR or MANAGEMENT is creating, set verification details
        // Only set verifiedById if creatorId is valid and user exists
        ...(status === "APPROVED" && creatorId && creator ? {
          verifiedById: creatorId,
          verifiedAt: new Date()
        } : {})
      },
    });

    // If salary exists and is in PENDING state, recalculate it
    if (existingSalary?.status === 'PENDING') {
      const { calculateSalary } = await import('@/lib/services/salary-calculator');
      const salaryDetails = await calculateSalary(data.userId, attendanceDate.getMonth() + 1, attendanceDate.getFullYear());

      await prisma.salary.update({
        where: { id: existingSalary.id },
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

    // Log attendance creation
    await logEntityActivity(
      ActivityType.ATTENDANCE_CREATED,
      creatorId,
      "Attendance",
      attendance.id,
      `Created attendance for ${data.userId} on ${data.date}: ${data.isPresent ? "Present" : "Absent"}${data.isHalfDay ? " (Half Day)" : ""}`,
      {
        attendanceId: attendance.id,
        userId: data.userId,
        date: data.date,
        isPresent: data.isPresent,
        isHalfDay: data.isHalfDay,
        status: attendance.status,
      },
      req
    );

    return new Response(JSON.stringify(attendance), { status: 201 });
  } catch (error) {
    console.error('Error creating attendance:', error);
    return new Response('Error creating attendance', { status: 500 });
  }
}

// Add a verification endpoint for HR
export async function PATCH(req: Request) {
  try {
    const session = await auth();

    // @ts-expect-error - role is not in the User type
    if (!session || session.user.role !== "HR") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const {
      attendanceId,
      status,
      verificationNote,
    } = await req.json();

    // Get the attendance record to check its date
    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId }
    });

    if (!attendance) {
      return NextResponse.json(
        { error: "Attendance not found" },
        { status: 404 }
      );
    }

    // Check if salary exists for this month and its status
    const attendanceDate = new Date(attendance.date);
    const existingSalary = await prisma.salary.findFirst({
      where: {
        userId: attendance.userId,
        month: attendanceDate.getMonth() + 1,
        year: attendanceDate.getFullYear(),
        status: {
          in: ['PENDING', 'PROCESSING']
        }
      }
    });

    if (existingSalary?.status === 'PROCESSING') {
      throw new Error('Cannot edit attendance as salary is already in processing state');
    }

    const verifierId = (session.user as { id?: string }).id;
    
    if (!verifierId) {
      return NextResponse.json(
        { error: "User ID not found in session" },
        { status: 401 }
      );
    }

    // Verify the verifier user exists in the database
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

    const updatedAttendance = await prisma.attendance.update({
      where: {
        id: attendanceId,
      },
      data: {
        status,
        verifiedById: verifierId,
        verifiedAt: new Date(),
        verificationNote,
      },
    });

    // If salary exists and is in PENDING state, recalculate it
    if (existingSalary?.status === 'PENDING') {
      const { calculateSalary } = await import('@/lib/services/salary-calculator');
      const salaryDetails = await calculateSalary(attendance.userId, attendanceDate.getMonth() + 1, attendanceDate.getFullYear());

      await prisma.salary.update({
        where: { id: existingSalary.id },
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

    // Log attendance verification
    await logEntityActivity(
      status === "APPROVED" ? ActivityType.ATTENDANCE_VERIFIED : ActivityType.ATTENDANCE_REJECTED,
      verifierId,
      "Attendance",
      attendanceId,
      `${status === "APPROVED" ? "Approved" : "Rejected"} attendance for user ${attendance.userId}`,
      {
        attendanceId,
        userId: attendance.userId,
        status,
        verificationNote,
      },
      req
    );

    return NextResponse.json(updatedAttendance);
  } catch (error) {
    console.error("Error verifying attendance:", error);
    return NextResponse.json(
      { error: "Failed to verify attendance" },
      { status: 500 }
    );
  }
} 
