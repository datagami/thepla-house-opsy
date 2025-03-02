import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: Request,
  { params }: { params: { branchId: string } }
) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "MANAGEMENT") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const branch = await prisma.branch.findUnique({
      where: { id: params.branchId },
      include: {
        _count: {
          select: {
            users: true,
            managers: true,
          },
        },
      },
    });

    if (!branch) {
      return NextResponse.json(
        { error: "Branch not found" },
        { status: 404 }
      );
    }

    if (branch._count.users > 0 || branch._count.managers > 0) {
      return NextResponse.json(
        { error: "Cannot delete branch with assigned users1" },
        { status: 400 }
      );
    }

    await prisma.branch.delete({
      where: { id: params.branchId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting branch:", error);
    return NextResponse.json(
      { error: "Failed to delete branch" },
      { status: 500 }
    );
  }
} 
