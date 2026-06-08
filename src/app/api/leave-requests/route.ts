import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logEntityActivity } from "@/lib/services/activity-log";
import { ActivityType, LeaveType } from "@prisma/client";
import { notifyNewLeaveRequest } from "@/lib/services/leave-notifications";

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
    const requesterName = (session.user as { name?: string | null }).name ?? null;

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
    } else if (role === "HR" || role === "MANAGEMENT") {
      // HR / Management may file leave for ANY active user (across branches),
      // including themselves. If no userId is provided, default to self.
      if (!requestedUserId || requestedUserId === sessionUserId) {
        targetUserId = sessionUserId;
      } else {
        const target = await prisma.user.findFirst({
          where: { id: requestedUserId, status: "ACTIVE" },
          select: { id: true, name: true },
        });

        if (!target) {
          return NextResponse.json(
            { error: "Employee not found or inactive" },
            { status: 404 }
          );
        }

        targetUserId = target.id;
        targetUserName = target.name ?? null;
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
          error: isSelf
            ? "You already have a leave request for these dates"
            : "Employee already has a leave request for these dates",
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
      targetUserId === sessionUserId
        ? `Created leave request for self: ${leaveType} from ${startDate} to ${endDate}`
        : `Created leave request for ${targetUserName ?? "employee"}: ${leaveType} from ${startDate} to ${endDate}`,
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

    // Notify role mailboxes of the new leave request after the response is sent.
    // notifyNewLeaveRequest swallows its own errors, so this can never break creation
    // and `after()` keeps the work alive on serverless runtimes past the response.
    const employeeName =
      targetUserId === sessionUserId ? requesterName : targetUserName;
    // Pull the employee's branch / department / doj / numId so the PDF
    // attachment in the email can render the same fields as the on-screen
    // form. Self-creation uses the session user; on-behalf uses the target.
    const employeeForPdf = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        numId: true,
        doj: true,
        department: { select: { name: true } },
        branch: { select: { name: true } },
      },
    });
    after(
      notifyNewLeaveRequest({
        leaveRequestId: leaveRequest.id,
        leaveRequestNumId: leaveRequest.numId,
        filedAt: leaveRequest.createdAt,
        requesterName,
        employeeName,
        employeeNumId: employeeForPdf?.numId ?? null,
        employeeDepartment: employeeForPdf?.department?.name ?? null,
        employeeBranch: employeeForPdf?.branch?.name ?? null,
        employeeDoj: employeeForPdf?.doj ?? null,
        leaveType: leaveType as LeaveType,
        startDate,
        endDate,
        reason,
      })
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
