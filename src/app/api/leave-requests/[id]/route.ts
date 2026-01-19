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

    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!session || !role || !["MANAGEMENT", "HR"].includes(role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
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
    const sessionUserId = (session.user as { id?: string }).id;
    if (!sessionUserId) {
      return NextResponse.json(
        { error: "User ID not found in session" },
        { status: 401 }
      );
    }
    await logEntityActivity(
      status === "APPROVED" 
        ? ActivityType.LEAVE_REQUEST_APPROVED 
        : ActivityType.LEAVE_REQUEST_REJECTED,
      sessionUserId,
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
