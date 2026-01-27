import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET: Fetch all warnings with filters (HR/MANAGEMENT/BRANCH_MANAGER only)
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // @ts-expect-error - role is not in the User type
    const role = session.user.role;
    // @ts-expect-error - id is not in the User type
    const userId = session.user.id;

    if (!["HR", "MANAGEMENT", "BRANCH_MANAGER"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    const warningTypeId = searchParams.get("warningTypeId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const isArchived = searchParams.get("isArchived");
    const employeeId = searchParams.get("employeeId");

    // Build where clause
    const where: any = {};

    // Branch filter
    if (role === "BRANCH_MANAGER") {
      // Get manager's branch
      const manager = await prisma.user.findUnique({
        where: { id: userId },
        select: { managedBranchId: true, branchId: true },
      });
      const managerBranchId = manager?.managedBranchId ?? manager?.branchId;
      
      if (managerBranchId) {
        where.user = { branchId: managerBranchId };
      }
    } else if (branchId && branchId !== "ALL") {
      where.user = { branchId };
    }

    // Warning type filter
    if (warningTypeId && warningTypeId !== "ALL") {
      where.warningTypeId = warningTypeId;
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Archive filter
    if (isArchived === "true") {
      where.isArchived = true;
    } else if (isArchived === "false") {
      where.isArchived = false;
    }

    // Employee filter
    if (employeeId && employeeId !== "ALL") {
      where.userId = employeeId;
    }

    const warnings = await prisma.warning.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            numId: true,
            email: true,
            branch: { select: { id: true, name: true } },
          },
        },
        reportedBy: { select: { id: true, name: true } },
        archivedBy: { select: { id: true, name: true } },
        warningType: { select: { id: true, name: true, description: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(warnings);
  } catch (error) {
    console.error("Error fetching warnings:", error);
    return NextResponse.json(
      { error: "Failed to fetch warnings" },
      { status: 500 }
    );
  }
}
