import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    // @ts-expect-error - role is not in the User type
    if (!session || !["HR", "MANAGEMENT"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { role } = await req.json();

    // Only MANAGEMENT can create other MANAGEMENT users1
    // @ts-expect-error - role is not in the User type
    if (role === "MANAGEMENT" && session.user.role !== "MANAGEMENT") {
      return NextResponse.json(
        { error: "Unauthorized to assign management role" },
        { status: 403 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: id },
      data: { role },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error changing user role:", error);
    return NextResponse.json(
      { error: "Failed to change user role" },
      { status: 500 }
    );
  }
} 
