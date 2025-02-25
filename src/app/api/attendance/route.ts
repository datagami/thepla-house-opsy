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
    } = await req.json();

    // Convert date string to Date object
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Check if attendance record exists for this date
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        userId,
        date: attendanceDate,
      },
    });

    // Base attendance data
    const attendanceData = {
      isPresent,
      checkIn: isPresent ? checkIn : null,
      checkOut: isPresent ? checkOut : null,
      isHalfDay: isPresent ? isHalfDay : false,
      overtime: isPresent ? overtime : false,
      shift1: isPresent ? shift1 : false,
      shift2: isPresent ? shift2 : false,
      shift3: isPresent ? shift3 : false,
      status: "PENDING", // All attendance records need verification
    };

    if (existingAttendance) {
      // Update existing attendance
      const updatedAttendance = await prisma.attendance.update({
        where: {
          id: existingAttendance.id,
        },
        data: {
          ...attendanceData,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json(updatedAttendance);
    }

    // Create new attendance
    const newAttendance = await prisma.attendance.create({
      data: {
        userId,
        date: attendanceDate,
        ...attendanceData,
      },
    });

    return NextResponse.json(newAttendance);
  } catch (error) {
    console.error("Error in attendance API:", error);
    return NextResponse.json(
      { error: "Failed to process attendance" },
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