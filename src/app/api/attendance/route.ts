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
    const status = session.user.role === "HR" ? "APPROVED" : "PENDING_VERIFICATION";
    
    const attendance = await prisma.attendance.create({
      data: {
        ...body,
        status,
        // If HR is creating, set verification details
        ...(session.user.role === "HR" && {
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
