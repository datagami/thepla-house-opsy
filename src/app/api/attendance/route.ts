import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

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
    // @ts-expect-error - id is not in the session type
    const creatorId = session.user.id;

    // Check if user is trying to submit attendance for themselves
    const isSelfAttendance = creatorId === data.userId;

    // Define roles that can submit their own attendance
    const canSubmitSelfAttendance = ["HR", "MANAGEMENT", "SELF_ATTENDANCE"].includes(user.role);

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
    const status = ["HR", "MANAGEMENT"].includes(creatorRole)
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

    // Create attendance with the user's current branch
    const attendance = await prisma.attendance.create({
      data: {
        date: attendanceDate,
        isPresent: data.isPresent,
        isHalfDay: data.isHalfDay,
        overtime: data.overtime,
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
        ...(status === "APPROVED" && {
          verifiedById: creatorId,
          verifiedAt: new Date()
        })
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

    const updatedAttendance = await prisma.attendance.update({
      where: {
        id: attendanceId,
      },
      data: {
        status,
        // @ts-expect-error - branchId is not in the User
        verifiedById: session.user.id,
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

    return NextResponse.json(updatedAttendance);
  } catch (error) {
    console.error("Error verifying attendance:", error);
    return NextResponse.json(
      { error: "Failed to verify attendance" },
      { status: 500 }
    );
  }
} 
