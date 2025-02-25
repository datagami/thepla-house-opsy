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
      verificationNote, // For HR verification
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
      checkIn,
      checkOut,
      isHalfDay,
      overtime,
      shift1,
      shift2,
      shift3,
    };

    // Add verification data if HR is verifying
    if (session.user.role === "HR" && verificationNote) {
      Object.assign(attendanceData, {
        status: "APPROVED",
        verifiedById: session.user.id,
        verifiedAt: new Date(),
        verificationNote,
      });
    }

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
    } else {
      // Create new attendance record
      const newAttendance = await prisma.attendance.create({
        data: {
          userId,
          date: attendanceDate,
          ...attendanceData,
        },
      });

      return NextResponse.json(newAttendance);
    }
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