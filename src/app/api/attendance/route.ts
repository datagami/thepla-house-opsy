import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: Request) {
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
      status,
      verifiedById,
      verifiedAt,
      verificationNote,
    } = await req.json();

    const attendance = await prisma.attendance.create({
      data: {
        userId,
        date: new Date(date),
        isPresent,
        checkIn: checkIn && isPresent ? checkIn : null,
        checkOut: checkOut && isPresent ? checkOut : null,
        isHalfDay: isPresent && isHalfDay,
        overtime: isPresent && overtime,
        shift1: isPresent && shift1,
        shift2: isPresent && shift2,
        shift3: isPresent && shift3,
        status: status || "PENDING",
        verifiedById: verifiedById || null,
        verifiedAt: verifiedAt ? new Date(verifiedAt) : new Date(),
        verificationNote: verificationNote || "Marked by user",
      },
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error("Error creating attendance:", error);
    return NextResponse.json(
      { error: "Failed to create attendance" },
      { status: 500 }
    );
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
