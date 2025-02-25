import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "MANAGEMENT") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { status } = await req.json();

    const updatedRequest = await prisma.leaveRequest.update({
      where: {
        id: params.id,
      },
      data: {
        status,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updatedRequest);
  } catch (error) {
    console.error("Error updating leave request:", error);
    return NextResponse.json(
      { error: "Failed to update leave request" },
      { status: 500 }
    );
  }
} 