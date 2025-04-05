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
        branchId: true 
      }
    });

    if (!user) {
      return new Response('User not found', { status: 404 });
    }

    // Check if salary exists for this month and its status
    const attendanceDate = new Date(data.date);
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
      return new NextResponse(
        { error: 'Cannot edit attendance as salary is already in processing state' },
        { status: 400 }
      );
    }

    // Set initial status based on who's creating the attendance
    // @ts-expect-error - role is not in the session type
    const creatorRole = session.user.role;
    const status = creatorRole === "HR"
      ? "APPROVED" 
      : "PENDING_VERIFICATION";

    // Create attendance with the user's current branch
    const attendance = await prisma.attendance.create({
      data: {
        date: new Date(data.date),
        isPresent: data.isPresent,
        isHalfDay: data.isHalfDay,
        overtime: data.overtime,
        userId: data.userId,
        // @ts-expect-error - branchId is not in the User
        branchId: user.branchId,
        status,
        // If HR or Branch Manager is creating, set verification details
        ...(status === "APPROVED" && {
          // @ts-expect-error - id is not in the session type
          verifiedById: session.user.id,
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
      return new NextResponse(
        { error: 'Cannot edit attendance as salary is already in processing state' },
        { status: 400 }
      );
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
