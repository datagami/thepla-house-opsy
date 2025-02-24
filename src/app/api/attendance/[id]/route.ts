import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session || !["BRANCH_MANAGER", "HR"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const {
      isPresent,
      checkIn,
      checkOut,
      isHalfDay,
      overtime,
      shift1,
      shift2,
      shift3,
    } = await req.json();

    const attendance = await prisma.attendance.findUnique({
      where: { id: params.id },
      select: { date: true },
    });

    if (!attendance) {
      return NextResponse.json(
        { error: "Attendance not found" },
        { status: 404 }
      );
    }

    const updatedAttendance = await prisma.attendance.update({
      where: { id: params.id },
      data: {
        isPresent,
        checkIn: checkIn && isPresent ? new Date(`${attendance.date.toISOString().split('T')[0]}T${checkIn}`) : null,
        checkOut: checkOut && isPresent ? new Date(`${attendance.date.toISOString().split('T')[0]}T${checkOut}`) : null,
        isHalfDay: isPresent && isHalfDay,
        overtime: isPresent && overtime,
        shift1: isPresent && shift1,
        shift2: isPresent && shift2,
        shift3: isPresent && shift3,
        status: "PENDING", // Reset status to PENDING after edit
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