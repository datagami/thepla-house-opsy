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

    const { startDate, endDate, leaveType, reason } = await req.json();

    // Basic validation
    if (!startDate || !endDate || !leaveType || !reason) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if there's an overlapping leave request
    const existingLeave = await prisma.leaveRequest.findFirst({
      where: {
        // @ts-expect-error - userId is not in the User type
        userId: session.user.id,
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
      return NextResponse.json(
        { error: "You already have a leave request for these dates" },
        { status: 400 }
      );
    }

    // @ts-expect-error - userId is not in the User type
    const userId = session.user.id || '';
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        userId: userId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        leaveType: leaveType as "CASUAL" | "SICK" | "ANNUAL" | "UNPAID" | "OTHER",
        reason,
        status: "PENDING",
      },
    });

    return NextResponse.json(leaveRequest);
  } catch (error) {
    console.error("Error creating leave request:", error);
    return NextResponse.json(
      { error: "Failed to create leave request" },
      { status: 500 }
    );
  }
} 
