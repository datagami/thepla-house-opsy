import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { branchId } = await req.json();

    // Allow null branchId for management users (all branches view)
    if (branchId === null && session.user.role === "MANAGEMENT") {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { selectedBranchId: null },
      });

      // Revalidate the layout to update the UI
      revalidatePath('/(auth)', 'layout');
      return NextResponse.json({ success: true });
    }

    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    // Verify branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      return NextResponse.json(
        { error: "Branch not found" },
        { status: 404 }
      );
    }

    // For branch managers, verify they manage this branch
    if (session.user.role === "BRANCH_MANAGER") {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { managedBranch: true },
      });

      if (user?.managedBranch?.id !== branchId) {
        return NextResponse.json(
          { error: "Unauthorized to access this branch" },
          { status: 403 }
        );
      }
    }

    // Update session with selected branch
    await prisma.user.update({
      where: { id: session.user.id },
      data: { selectedBranchId: branchId },
    });

    // Revalidate the layout to update the UI
    revalidatePath('/(auth)', 'layout');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Branch selection error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
} 