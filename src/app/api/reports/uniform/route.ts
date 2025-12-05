import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session?.user || !["HR", "MANAGEMENT", "BRANCH_MANAGER"].includes(session.user.role)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const branchFilter = searchParams.get("branch") || "ALL";

    // @ts-expect-error - branchId is not in the User type
    const userBranchId = session.user.branchId;
    // @ts-expect-error - role is not in the User type
    const isBranchManager = session.user.role === "BRANCH_MANAGER";

    // Calculate date range for the year
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    // Build where clause
    const whereClause: Prisma.UniformWhereInput = {
      issuedAt: {
        gte: yearStart,
        lte: yearEnd,
      },
      user: {
        status: "ACTIVE",
        ...(isBranchManager && { branchId: userBranchId }),
        ...(branchFilter !== "ALL" && !isBranchManager && {
          branch: {
            name: branchFilter,
          },
        }),
      },
    };

    // Get all uniforms for the year
    const uniforms = await prisma.uniform.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            branch: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Calculate statistics
    const totalIssued = uniforms.length;
    const totalReturned = uniforms.filter((u) => u.status === "RETURNED").length;
    const totalLost = uniforms.filter((u) => u.status === "LOST").length;
    const totalDamaged = uniforms.filter((u) => u.status === "DAMAGED").length;

    // Group by status
    const statusMap = new Map<string, number>();
    uniforms.forEach((u) => {
      statusMap.set(u.status, (statusMap.get(u.status) || 0) + 1);
    });

    const uniformsByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
    }));

    // Group by type
    const typeMap = new Map<string, number>();
    uniforms.forEach((u) => {
      typeMap.set(u.itemType, (typeMap.get(u.itemType) || 0) + 1);
    });

    const uniformsByType = Array.from(typeMap.entries()).map(([type, count]) => ({
      type,
      count,
    }));

    // Recent issues (last 20)
    const recentIssues = uniforms
      .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime())
      .slice(0, 20)
      .map((u) => ({
        employeeName: u.user.name || "Unknown",
        itemName: u.itemName,
        itemType: u.itemType,
        issuedAt: u.issuedAt.toISOString().split("T")[0],
        status: u.status,
      }));

    return NextResponse.json({
      totalIssued,
      totalReturned,
      totalLost,
      totalDamaged,
      uniformsByStatus,
      uniformsByType,
      recentIssues,
    });
  } catch (error) {
    console.error("Error generating uniform report:", error);
    return NextResponse.json(
      { error: "Failed to generate uniform report" },
      { status: 500 }
    );
  }
}

