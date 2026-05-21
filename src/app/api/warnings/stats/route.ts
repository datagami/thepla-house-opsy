import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET: Fetch warning statistics (HR/MANAGEMENT/BRANCH_MANAGER only)
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // @ts-expect-error - role is not in the User type
    const role = session.user.role;
    const userId = session.user.id;

    if (!["HR", "MANAGEMENT", "BRANCH_MANAGER"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build where clause for date range
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.lte = end;
      }
    }

    // Branch filter for branch managers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let branchFilter: any = {};
    if (role === "BRANCH_MANAGER") {
      const manager = await prisma.user.findUnique({
        where: { id: userId },
        select: { managedBranchId: true, branchId: true },
      });
      const managerBranchId = manager?.managedBranchId ?? manager?.branchId;
      
      if (managerBranchId) {
        branchFilter = { user: { branchId: managerBranchId } };
      }
    }

    const where = { ...dateFilter, ...branchFilter };

    // Get statistics
    const [
      totalWarnings,
      activeWarnings,
      archivedWarnings,
      warningsByType,
      warningsByBranch,
      recentWarnings,
    ] = await Promise.all([
      // Total warnings
      prisma.warning.count({ where }),
      
      // Active warnings
      prisma.warning.count({ where: { ...where, isArchived: false } }),
      
      // Archived warnings
      prisma.warning.count({ where: { ...where, isArchived: true } }),
      
      // Warnings by type
      prisma.warning.groupBy({
        by: ["warningTypeId"],
        where,
        _count: { id: true },
      }).then(async (results) => {
        const types = await prisma.warningType.findMany({
          where: { id: { in: results.map(r => r.warningTypeId).filter(Boolean) as string[] } },
          select: { id: true, name: true },
        });
        
        return results.map(r => ({
          warningTypeId: r.warningTypeId,
          warningTypeName: types.find(t => t.id === r.warningTypeId)?.name || "Unknown",
          count: r._count.id,
        }));
      }),
      
      // Warnings by branch
      prisma.warning.findMany({
        where,
        select: {
          user: {
            select: {
              branch: { select: { id: true, name: true } },
            },
          },
        },
      }).then(warnings => {
        const branchCounts = new Map<string, { name: string; count: number }>();
        warnings.forEach(w => {
          if (w.user.branch) {
            const existing = branchCounts.get(w.user.branch.id) || { name: w.user.branch.name, count: 0 };
            existing.count++;
            branchCounts.set(w.user.branch.id, existing);
          }
        });
        return Array.from(branchCounts.entries()).map(([id, data]) => ({
          branchId: id,
          branchName: data.name,
          count: data.count,
        }));
      }),
      
      // Recent warnings (last 30 days)
      prisma.warning.groupBy({
        by: ["createdAt"],
        where: {
          ...branchFilter,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        _count: { id: true },
      }),
    ]);

    return NextResponse.json({
      totalWarnings,
      activeWarnings,
      archivedWarnings,
      warningsByType,
      warningsByBranch,
      recentWarnings,
    });
  } catch (error) {
    console.error("Error fetching warning statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
