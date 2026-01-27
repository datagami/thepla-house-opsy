import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const isSettled = searchParams.get("isSettled");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const branchId = searchParams.get("branchId");

    // @ts-expect-error - role is not in the User type
    const userRole = session.user.role;
    const isHROrManagement = ["HR", "MANAGEMENT"].includes(userRole);
    const userId = session.user.id;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    // Role-based filtering: employees see only their own advances
    if (!isHROrManagement) {
      where.userId = userId;
    }

    // Settlement filter
    if (isSettled !== null && isSettled !== undefined && isSettled !== "") {
      where.isSettled = isSettled === "true";
    }

    // Status filter
    if (status && status !== "ALL") {
      where.status = status;
    }

    // Date range filter
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        where.createdAt.lte = new Date(toDate);
      }
    }

    // Branch filter (only for HR/Management)
    if (isHROrManagement && branchId && branchId !== "ALL") {
      where.user = {
        branchId: branchId,
      };
    }

    // Search filter (name or numId)
    if (search && isHROrManagement) {
      where.user = {
        ...where.user,
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { numId: isNaN(parseInt(search)) ? undefined : parseInt(search) },
        ].filter(Boolean),
      };
    }

    // Fetch all advances matching the filters
    const allAdvances = await prisma.advancePayment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            numId: true,
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        approvedBy: {
          select: {
            name: true,
            numId: true,
          },
        },
        installments: {
          include: {
            salary: {
              select: {
                month: true,
                year: true,
              },
            },
            approvedBy: {
              select: {
                name: true,
                numId: true,
              },
            },
          },
          orderBy: {
            paidAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Group advances by user
    const userAdvancesMap = new Map<
      string,
      {
        userId: string;
        userName: string;
        userNumId: number;
        userBranch: string;
        totalAdvanceAmount: number;
        totalRemainingAmount: number;
        totalEmiAmount: number;
        advancesCount: number;
        lastPaymentDate: Date | null;
        advances: typeof allAdvances;
      }
    >();

    allAdvances.forEach((advance) => {
      const userId = advance.userId;
      if (!userAdvancesMap.has(userId)) {
        userAdvancesMap.set(userId, {
          userId,
          userName: advance.user.name ?? "Unknown",
          userNumId: advance.user.numId,
          userBranch: advance.user.branch?.name ?? "N/A",
          totalAdvanceAmount: 0,
          totalRemainingAmount: 0,
          totalEmiAmount: 0,
          advancesCount: 0,
          lastPaymentDate: null,
          advances: [],
        });
      }

      const userStats = userAdvancesMap.get(userId)!;
      userStats.totalAdvanceAmount += advance.amount;
      userStats.totalRemainingAmount += advance.remainingAmount;
      userStats.totalEmiAmount += advance.emiAmount;
      userStats.advancesCount += 1;
      userStats.advances.push(advance);

      // Find latest payment date
      const latestInstallment = advance.installments
        .filter((i) => i.paidAt !== null)
        .sort(
          (a, b) =>
            (b.paidAt?.getTime() || 0) - (a.paidAt?.getTime() || 0)
        )[0];

      if (
        latestInstallment?.paidAt &&
        (!userStats.lastPaymentDate ||
          latestInstallment.paidAt > userStats.lastPaymentDate)
      ) {
        userStats.lastPaymentDate = latestInstallment.paidAt;
      }
    });

    // Convert map to array and sort by remaining balance (highest first)
    const advances = Array.from(userAdvancesMap.values()).sort(
      (a, b) => b.totalRemainingAmount - a.totalRemainingAmount
    );

    // Calculate summary stats
    const stats = {
      totalAmount: allAdvances.reduce((sum, adv) => sum + adv.amount, 0),
      totalOutstanding: allAdvances.reduce(
        (sum, adv) => sum + adv.remainingAmount,
        0
      ),
      totalEmiDeductions: allAdvances.reduce(
        (sum, adv) => sum + adv.emiAmount,
        0
      ),
      employeesCount: userAdvancesMap.size,
    };

    return NextResponse.json({
      advances,
      stats,
    });
  } catch (error) {
    console.error("Error fetching advances:", error);
    return NextResponse.json(
      { error: "Failed to fetch advances" },
      { status: 500 }
    );
  }
}
