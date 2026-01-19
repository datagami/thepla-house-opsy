import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logEntityActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { startDate, endDate, leaveType, reason, userId: requestedUserId } = await req.json();

    // Basic validation
    if (!startDate || !endDate || !leaveType || !reason) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const sessionUserId = (session.user as { id?: string; role?: string; branchId?: string | null }).id;
    const role = (session.user as { role?: string }).role;
    const managerBranchId = (session.user as { branchId?: string | null }).branchId ?? null;

    if (!sessionUserId) {
      return NextResponse.json(
        { error: "User ID not found in session" },
        { status: 401 }
      );
    }

    let targetUserId: string;
    let targetUserName: string | null = null;

    if (role === "BRANCH_MANAGER") {
      if (!managerBranchId) {
        return NextResponse.json(
          { error: "Manager branch not found" },
          { status: 400 }
        );
      }

      // If no userId is provided, manager is creating for self.
      if (!requestedUserId) {
        targetUserId = sessionUserId;
      } else {
        // Allow explicit self as well
        if (requestedUserId === sessionUserId) {
          targetUserId = sessionUserId;
        } else {
          const employee = await prisma.user.findFirst({
            where: {
              id: requestedUserId,
              branchId: managerBranchId,
              role: "EMPLOYEE",
              status: "ACTIVE",
            },
            select: { id: true, name: true },
          });

          if (!employee) {
            return NextResponse.json(
              { error: "Employee not found in your branch" },
              { status: 403 }
            );
          }

          targetUserId = employee.id;
          targetUserName = employee.name ?? null;
        }
      }
    } else if (role === "EMPLOYEE") {
      targetUserId = sessionUserId;
    } else {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Check if there's an overlapping leave request
    const existingLeave = await prisma.leaveRequest.findFirst({
      where: {
        userId: targetUserId,
        OR: [
          {
            AND: [
              { startDate: { lte: new Date(startDate) } },
              { endDate: { gte: new Date(startDate) } },
            ],
          },
          {
            AND: [
              { startDate: { lte: new Date(endDate) } },
              { endDate: { gte: new Date(endDate) } },
            ],
          },
        ],
      },
    });

    if (existingLeave) {
      const isSelf = targetUserId === sessionUserId;
      return NextResponse.json(
        {
          error:
            role === "BRANCH_MANAGER"
              ? isSelf
                ? "You already have a leave request for these dates"
                : "Employee already has a leave request for these dates"
              : "You already have a leave request for these dates",
        },
        { status: 400 }
      );
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        userId: targetUserId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        leaveType: leaveType as "CASUAL" | "SICK" | "ANNUAL" | "UNPAID" | "OTHER",
        reason,
        status: "PENDING",
      },
    });

    // Log leave request creation
    await logEntityActivity(
      ActivityType.LEAVE_REQUEST_CREATED,
      sessionUserId,
      "LeaveRequest",
      leaveRequest.id,
      role === "BRANCH_MANAGER"
        ? targetUserId === sessionUserId
          ? `Created leave request for self: ${leaveType} from ${startDate} to ${endDate}`
          : `Created leave request for ${targetUserName ?? "employee"}: ${leaveType} from ${startDate} to ${endDate}`
        : `Created leave request: ${leaveType} from ${startDate} to ${endDate}`,
      {
        leaveRequestId: leaveRequest.id,
        userId: leaveRequest.userId,
        createdByUserId: sessionUserId,
        leaveType,
        startDate,
        endDate,
      },
      req
    );

    return NextResponse.json(leaveRequest);
  } catch (error) {
    console.error("Error creating leave request:", error);
    return NextResponse.json(
      { error: "Failed to create leave request" },
      { status: 500 }
    );
  }
} 
