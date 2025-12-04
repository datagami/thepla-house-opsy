import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session || !["HR", "MANAGEMENT", "BRANCH_MANAGER"].includes(session.user.role)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // @ts-expect-error - branchId is not in the User type
    const userBranchId = session.user.branchId;
    const isBranchManager = session.user.role === "BRANCH_MANAGER";

    if (isBranchManager) {
      // Return only the branch manager's branch
      const branch = await prisma.branch.findUnique({
        where: { id: userBranchId || "" },
        select: { name: true },
      });

      return NextResponse.json(branch ? [branch.name] : []);
    }

    // For HR and MANAGEMENT, return all branches
    const branches = await prisma.branch.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(branches.map((b) => b.name));
  } catch (error) {
    console.error("Error fetching branches:", error);
    return NextResponse.json(
      { error: "Failed to fetch branches" },
      { status: 500 }
    );
  }
}

