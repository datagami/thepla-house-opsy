import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // @ts-expect-error - role is not in the User type
    const userRole = session.user.role;
    if (!["HR", "MANAGEMENT"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all advance payments with all their installments
    const advances = await prisma.advancePayment.findMany({
      where: {
        status: "APPROVED",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            numId: true,
            branch: { select: { name: true } },
          },
        },
        installments: {
          include: {
            salary: {
              select: { month: true, year: true, status: true },
            },
            approvedBy: {
              select: { name: true, numId: true },
            },
          },
          orderBy: { approvedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all affected user IDs for activity log lookup
    const allUserIds = [...new Set(advances.map((a) => a.userId))];

    // Fetch salary deletion logs to identify which months were deleted
    const deletionLogs = await prisma.activityLog.findMany({
      where: {
        activityType: "SALARY_DELETED",
        metadata: { not: null },
        ...(allUserIds.length > 0 && {
          OR: allUserIds.map((uid) => ({
            metadata: { contains: uid },
          })),
        }),
      },
      select: {
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Parse deletion logs into a map: userId -> [{month, year, deletedAt}]
    const deletionsByUser = new Map<
      string,
      Array<{ month: number; year: number; deletedAt: Date }>
    >();
    for (const log of deletionLogs) {
      try {
        const meta = JSON.parse(log.metadata!);
        if (meta.userId && meta.month && meta.year) {
          if (!deletionsByUser.has(meta.userId)) {
            deletionsByUser.set(meta.userId, []);
          }
          deletionsByUser.get(meta.userId)!.push({
            month: meta.month,
            year: meta.year,
            deletedAt: log.createdAt,
          });
        }
      } catch {
        // skip malformed metadata
      }
    }

    // Build consolidated data grouped by user, only including users with discrepancies
    const userMap = new Map<
      string,
      {
        userId: string;
        userName: string;
        userNumId: number;
        userBranch: string;
        totalDiscrepancy: number;
        deletedSalaryMonths: Array<{ month: number; year: number; deletedAt: Date }>;
        advances: Array<{
          advanceId: string;
          advanceNumId: number;
          amount: number;
          emiAmount: number;
          remainingAmount: number;
          isSettled: boolean;
          createdAt: Date;
          totalDeducted: number;
          totalTracked: number;
          discrepancyAmount: number;
          installments: Array<{
            id: string;
            amountPaid: number;
            status: string;
            approvedAt: Date | null;
            paidAt: Date | null;
            salaryMonth: number | null;
            salaryYear: number | null;
            salaryStatus: string | null;
            approvedByName: string | null;
          }>;
        }>;
      }
    >();

    for (const advance of advances) {
      const approvedInstallments = advance.installments.filter(
        (i) => i.status === "APPROVED" || i.status === "PAID"
      );
      const totalTracked = approvedInstallments.reduce(
        (sum, inst) => sum + inst.amountPaid,
        0
      );
      const totalDeducted = advance.amount - advance.remainingAmount;
      const discrepancyAmount =
        Math.round((totalDeducted - totalTracked) * 100) / 100;

      if (discrepancyAmount <= 0) continue;

      if (!userMap.has(advance.userId)) {
        userMap.set(advance.userId, {
          userId: advance.userId,
          userName: advance.user.name ?? "Unknown",
          userNumId: advance.user.numId,
          userBranch: advance.user.branch?.name ?? "N/A",
          totalDiscrepancy: 0,
          deletedSalaryMonths: deletionsByUser.get(advance.userId) ?? [],
          advances: [],
        });
      }

      const userData = userMap.get(advance.userId)!;
      userData.totalDiscrepancy += discrepancyAmount;

      userData.advances.push({
        advanceId: advance.id,
        advanceNumId: advance.numId,
        amount: advance.amount,
        emiAmount: advance.emiAmount,
        remainingAmount: advance.remainingAmount,
        isSettled: advance.isSettled,
        createdAt: advance.createdAt,
        totalDeducted,
        totalTracked,
        discrepancyAmount,
        installments: advance.installments.map((inst) => ({
          id: inst.id,
          amountPaid: inst.amountPaid,
          status: inst.status,
          approvedAt: inst.approvedAt,
          paidAt: inst.paidAt,
          salaryMonth: inst.salary?.month ?? null,
          salaryYear: inst.salary?.year ?? null,
          salaryStatus: inst.salary?.status ?? null,
          approvedByName: inst.approvedBy?.name ?? null,
        })),
      });
    }

    const users = Array.from(userMap.values()).sort(
      (a, b) => b.totalDiscrepancy - a.totalDiscrepancy
    );

    const totalDiscrepancy = users.reduce(
      (sum, u) => sum + u.totalDiscrepancy,
      0
    );
    const affectedAdvances = users.reduce(
      (sum, u) => sum + u.advances.length,
      0
    );

    return NextResponse.json({
      users,
      stats: {
        totalDiscrepancy,
        affectedAdvances,
        affectedEmployees: users.length,
      },
    });
  } catch (error) {
    console.error("Error fetching advance discrepancies:", error);
    return NextResponse.json(
      { error: "Failed to fetch discrepancies" },
      { status: 500 }
    );
  }
}
