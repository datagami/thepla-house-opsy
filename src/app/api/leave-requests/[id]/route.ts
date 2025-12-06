import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logEntityActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    // @ts-expect-error - role is not in the User type
    if (!session || session.user.role !== "MANAGEMENT") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { status } = await req.json();

    const updatedRequest = await prisma.leaveRequest.update({
      where: {
        id: id,
      },
      data: {
        status,
        updatedAt: new Date(),
      },
    });

    // Log leave request status change
    // @ts-expect-error - id is not in the session type
    await logEntityActivity(
      status === "APPROVED" 
        ? ActivityType.LEAVE_REQUEST_APPROVED 
        : ActivityType.LEAVE_REQUEST_REJECTED,
      session.user.id,
      "LeaveRequest",
      id,
      `${status === "APPROVED" ? "Approved" : "Rejected"} leave request`,
      {
        leaveRequestId: id,
        userId: updatedRequest.userId,
        status,
      },
      req
    );

    return NextResponse.json(updatedRequest);
  } catch (error) {
    console.error("Error updating leave request:", error);
    return NextResponse.json(
      { error: "Failed to update leave request" },
      { status: 500 }
    );
  }
} 
