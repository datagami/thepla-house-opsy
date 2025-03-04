import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    
    // Set initial status based on who's creating the attendance
    // @ts-expect-error - role is not in the User type
    const role = session.user.role;
    const status = role === "HR" ? "APPROVED" : "PENDING_VERIFICATION";

    // Check if the user has already marked attendance for this date
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        userId: body.userId,
        date: body.date
      }
    });

    if (existingAttendance) {
      return NextResponse.json({ error: "Attendance already marked for this date" }, { status: 400 });
    }

    const attendance = await prisma.attendance.create({
      data: {
        ...body,
        status,
        // If HR is creating, set verification details
        ...(role === "HR" && {
          // @ts-expect-error - branchId is not in the User type
          verifiedById: session.user.id,
          verifiedAt: new Date()
        })
      }
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error("[ATTENDANCE_CREATE]", error);
    return new NextResponse("Internal error", { status: 500 });
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

    return NextResponse.json(updatedAttendance);
  } catch (error) {
    console.error("Error verifying attendance:", error);
    return NextResponse.json(
      { error: "Failed to verify attendance" },
      { status: 500 }
    );
  }
} 
