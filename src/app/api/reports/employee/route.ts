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

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const branchFilter = searchParams.get("branch") || "ALL";

    // @ts-expect-error - branchId is not in the User type
    const userBranchId = session.user.branchId;
    const isBranchManager = session.user.role === "BRANCH_MANAGER";

    // Build where clause
    const whereClause: any = {
      ...(isBranchManager && { branchId: userBranchId }),
      ...(branchFilter !== "ALL" && !isBranchManager && {
        branch: {
          name: branchFilter,
        },
      }),
    };

    // Get all employees
    const employees = await prisma.user.findMany({
      where: whereClause,
      include: {
        branch: {
          select: {
            name: true,
          },
        },
      },
    });

    // Calculate statistics
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter((e) => e.status === "ACTIVE").length;
    const inactiveEmployees = employees.filter((e) => e.status === "INACTIVE").length;
    const pendingEmployees = employees.filter((e) => e.status === "PENDING").length;

    // Group by branch
    const branchMap = new Map<string, number>();
    employees.forEach((emp) => {
      const branchName = emp.branch?.name || "Unknown";
      branchMap.set(branchName, (branchMap.get(branchName) || 0) + 1);
    });

    const employeesByBranch = Array.from(branchMap.entries()).map(([branch, count]) => ({
      branch,
      count,
    }));

    // Group by department
    const deptMap = new Map<string, number>();
    employees.forEach((emp) => {
      const dept = emp.department || "Not Assigned";
      deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
    });

    const employeesByDepartment = Array.from(deptMap.entries()).map(([department, count]) => ({
      department,
      count,
    }));

    // Group by role
    const roleMap = new Map<string, number>();
    employees.forEach((emp) => {
      const role = emp.role;
      roleMap.set(role, (roleMap.get(role) || 0) + 1);
    });

    const employeesByRole = Array.from(roleMap.entries()).map(([role, count]) => ({
      role,
      count,
    }));

    // Get new hires for the year
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const newHires = await prisma.user.findMany({
      where: {
        ...whereClause,
        doj: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
      select: {
        name: true,
        doj: true,
        branch: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        doj: "desc",
      },
    });

    return NextResponse.json({
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      pendingEmployees,
      employeesByBranch,
      employeesByDepartment,
      employeesByRole,
      newHires: newHires.map((nh) => ({
        name: nh.name || "Unknown",
        doj: nh.doj?.toISOString().split("T")[0] || "",
        branch: nh.branch?.name || "Unknown",
      })),
    });
  } catch (error) {
    console.error("Error generating employee report:", error);
    return NextResponse.json(
      { error: "Failed to generate employee report" },
      { status: 500 }
    );
  }
}

