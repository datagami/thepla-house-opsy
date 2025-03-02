import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: Request) {
  try {
    const session = await auth();

    // @ts-expect-error - role is not in the User type
    const role = session.user.role
    if (!session || role !== "HR") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { attendanceId, status, note } = await req.json();

    const updatedAttendance = await prisma.attendance.update({
      where: {
        id: attendanceId,
      },
      data: {
        status,
        // @ts-expect-error - branchId is not in the User type
        verifiedById: session.user.id,
        verifiedAt: new Date(),
        verificationNote: note,
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
