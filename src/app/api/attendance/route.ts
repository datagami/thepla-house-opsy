import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session || !["BRANCH_MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const {
      userId,
      date,
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
    // Set time to start of day
    attendanceDate.setHours(0, 0, 0, 0);

    // Check if attendance already exists for this date
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        userId,
        date: attendanceDate,
      },
    });

    if (existingAttendance) {
      // Update existing attendance
      const updatedAttendance = await prisma.attendance.update({
        where: {
          id: existingAttendance.id,
        },
        data: {
          checkIn: checkIn ? new Date(`${date}T${checkIn}`) : null,
          checkOut: checkOut ? new Date(`${date}T${checkOut}`) : null,
          isHalfDay,
          overtime,
          shift1,
          shift2,
          shift3,
        },
      });

      return NextResponse.json(updatedAttendance);
    }

    // Create new attendance
    const attendance = await prisma.attendance.create({
      data: {
        userId,
        date: attendanceDate,
        checkIn: checkIn ? new Date(`${date}T${checkIn}`) : null,
        checkOut: checkOut ? new Date(`${date}T${checkOut}`) : null,
        isHalfDay,
        overtime,
        shift1,
        shift2,
        shift3,
      },
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error("Error marking attendance:", error);
    return NextResponse.json(
      { error: "Failed to mark attendance" },
      { status: 500 }
    );
  }
} 