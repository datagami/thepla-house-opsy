import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

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
  data: any
) {
  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    select: { date: true },
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
      checkIn: data.checkIn && data.isPresent ? new Date(`${attendance.date.toISOString().split('T')[0]}T${data.checkIn}`) : null,
      checkOut: data.checkOut && data.isPresent ? new Date(`${attendance.date.toISOString().split('T')[0]}T${data.checkOut}`) : null,
      isHalfDay: data.isPresent && data.isHalfDay,
      overtime: data.isPresent && data.overtime,
      shift1: data.isPresent && data.shift1,
      shift2: data.isPresent && data.shift2,
      shift3: data.isPresent && data.shift3,
      status: "PENDING", // Reset status to pending
      verifiedById: null,
      verifiedAt: null,
      verificationNote: null,
    },
  });

  return NextResponse.json(updatedAttendance);
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const {
      userId,
      date,
      isPresent,
      checkIn,
      checkOut,
      isHalfDay,
      overtime,
      shift1,
      shift2,
      shift3,
    } = await req.json();

    // Update existing attendance and reset verification
    const updatedAttendance = await prisma.attendance.update({
      where: {
        id: params.id,
      },
      data: {
        isPresent,
        checkIn: checkIn && isPresent ? new Date(`${date}T${checkIn}`) : null,
        checkOut: checkOut && isPresent ? new Date(`${date}T${checkOut}`) : null,
        isHalfDay: isPresent && isHalfDay,
        overtime: isPresent && overtime,
        shift1: isPresent && shift1,
        shift2: isPresent && shift2,
        shift3: isPresent && shift3,
        // Reset verification status
        status: "PENDING",
        verifiedById: null,
        verifiedAt: null,
        verificationNote: null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updatedAttendance);
  } catch (error) {
    console.error("Error updating attendance:", error);
    return NextResponse.json(
      { error: "Failed to update attendance" },
      { status: 500 }
    );
  }
} 