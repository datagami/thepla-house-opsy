import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {Attendance} from "@/models/models";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session || !["HR", "BRANCH_MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const data = await req.json();

    // If HR is verifying
    if (session.user.role === "HR") {
      const { status, verificationNote } = data;
      return await handleHRVerification(params.id, status, verificationNote, session.user.id);
    }

    // If branch manager is resubmitting
    if (session.user.role === "BRANCH_MANAGER") {
      return await handleBranchManagerResubmission(params.id, data);
    }

  } catch (error) {
    console.error("Error in attendance API:", error);
    return NextResponse.json(
      { error: "Failed to process attendance" },
      { status: 500 }
    );
  }
}

async function handleHRVerification(
  attendanceId: string,
  status: string,
  verificationNote: string,
  verifierId: string
) {
  const updatedAttendance = await prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      status,
      verifiedById: verifierId,
      verifiedAt: new Date(),
      verificationNote,
    },
  });

  return NextResponse.json(updatedAttendance);
}

async function handleBranchManagerResubmission(
  attendanceId: string,
  data: Attendance
) {
  // Await the attendanceId if it's from params
  const id = await attendanceId;
  
  const attendance = await prisma.attendance.findUnique({
    where: { id },
    select: { 
      date: true,
      status: true,
      verificationNote: true,
      verifiedById: true,
      verifiedAt: true
    },
  });

  if (!attendance) {
    return NextResponse.json(
      { error: "Attendance not found" },
      { status: 404 }
    );
  }

  const updatedAttendance = await prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      isPresent: data.isPresent,
      date: data.date,
      checkIn: data.checkIn && data.isPresent ? data.checkIn : null,
      checkOut: data.checkOut && data.isPresent ? data.checkOut : null,
      isHalfDay: data.isPresent && data.isHalfDay,
      overtime: data.isPresent && data.overtime,
      shift1: data.isPresent && data.shift1,
      shift2: data.isPresent && data.shift2,
      shift3: data.isPresent && data.shift3,
      // Only reset verification if status is changing
      ...(data.status !== attendance.status ? {
        status: "PENDING",
        verifiedById: null,
        verifiedAt: null,
        verificationNote: null,
      } : {
        // Keep existing verification data
        status: attendance.status,
        verifiedById: attendance.verifiedById,
        verifiedAt: attendance.verifiedAt,
        verificationNote: attendance.verificationNote,
      })
    },
  });

  return NextResponse.json(updatedAttendance);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Get current attendance to check status
    const currentAttendance = await prisma.attendance.findUnique({
      where: { id }
    });

    if (!currentAttendance) {
      return new NextResponse("Attendance not found", { status: 404 });
    }

    // Handle status changes based on user role and current status
    let verificationData = {};
    
    if (session.user.role === "HR") {
      // HR updates always set to approved
      verificationData = {
        status: "APPROVED",
        verifiedById: session.user.id,
        verifiedAt: new Date()
      };
    } else if (session.user.role === "BRANCH_MANAGER") {
      // For branch manager, only change status if it was previously approved
      if (currentAttendance.status === "APPROVED") {
        verificationData = {
          status: "PENDING",
          verifiedById: null,
          verifiedAt: null,
          verificationNote: null
        };
      } else {
        // Keep existing status and verification data if not approved
        verificationData = {
          status: currentAttendance.status,
          verifiedById: currentAttendance.verifiedById,
          verifiedAt: currentAttendance.verifiedAt,
          verificationNote: currentAttendance.verificationNote
        };
      }
    }

    const attendance = await prisma.attendance.update({
      where: { id },
      data: {
        ...body,
        ...verificationData
      }
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error("[ATTENDANCE_UPDATE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
} 
