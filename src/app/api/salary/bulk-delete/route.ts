import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logEntityActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";
import { format } from "date-fns";

export async function POST(req: Request) {
  try {
    const session = await auth();
    // @ts-expect-error role is in session
    const role = session?.user?.role as string | undefined;
    if (!session?.user || !role || !["HR", "MANAGEMENT"].includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const sessionUserId = session.user.id!;

    const { salaryIds } = await req.json();

    if (!salaryIds || !Array.isArray(salaryIds) || salaryIds.length === 0) {
      return NextResponse.json(
        { error: "salaryIds array is required" },
        { status: 400 }
      );
    }

    // Fetch all salaries with their details
    const salaries = await prisma.salary.findMany({
      where: { id: { in: salaryIds } },
      include: {
        installments: { select: { id: true } },
        referrals: { select: { id: true, paidAt: true } },
      },
    });

    if (salaries.length === 0) {
      return NextResponse.json(
        { error: "No salaries found with provided IDs" },
        { status: 404 }
      );
    }

    // Validate all salaries can be deleted
    const validationErrors: Array<{ id: string; error: string }> = [];

    for (const salary of salaries) {
      // Safety: only allow deleting pending salaries that haven't been paid.
      if (salary.status !== "PENDING" || salary.paidAt) {
        validationErrors.push({
          id: salary.id,
          error: "Only pending (unpaid) salaries can be deleted",
        });
        continue;
      }

      // If referral bonuses were already processed/paid against this salary, don't allow deletion.
      const hasPaidReferrals = salary.referrals.some((r) => r.paidAt);
      if (hasPaidReferrals) {
        validationErrors.push({
          id: salary.id,
          error: "Cannot delete salary with processed referral bonuses",
        });
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Some salaries cannot be deleted",
          details: validationErrors,
        },
        { status: 400 }
      );
    }

    // Delete all salaries in a transaction
    const deletedCount = await prisma.$transaction(async (tx) => {
      let count = 0;

      for (const salary of salaries) {
        // Remove any unprocessed referral links (if any exist)
        if (salary.referrals.length > 0) {
          await tx.referral.updateMany({
            where: { salaryId: salary.id, paidAt: null },
            data: { salaryId: null },
          });
        }

        // Delete installments then salary
        await tx.advancePaymentInstallment.deleteMany({
          where: { salaryId: salary.id },
        });
        await tx.salary.delete({ where: { id: salary.id } });

        // Log the deletion
        await logEntityActivity(
          ActivityType.SALARY_DELETED,
          sessionUserId,
          "Salary",
          salary.id,
          `Deleted salary for ${format(new Date(salary.year, salary.month - 1), "MMMM yyyy")}`,
          {
            month: salary.month,
            year: salary.year,
            netSalary: salary.netSalary,
            userId: salary.userId,
          },
          req
        );

        count++;
      }

      return count;
    });

    return NextResponse.json({
      message: `Successfully deleted ${deletedCount} salary records`,
      deletedCount,
    });
  } catch (error) {
    console.error("Error deleting salaries:", error);
    return NextResponse.json(
      { error: "Failed to delete salaries" },
      { status: 500 }
    );
  }
}
