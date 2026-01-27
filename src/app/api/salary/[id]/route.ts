import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logEntityActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";
import { format } from "date-fns";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    // @ts-expect-error role is in session
    const role = session?.user?.role as string | undefined;
    if (!session?.user || !role || !["HR", "MANAGEMENT"].includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const salary = await prisma.salary.findUnique({
      where: { id },
      include: {
        installments: { select: { id: true } },
        referrals: { select: { id: true, paidAt: true } },
      },
    });

    if (!salary) {
      return NextResponse.json({ error: "Salary not found" }, { status: 404 });
    }

    // Safety: only allow deleting pending salaries that haven't been paid.
    if (salary.status !== "PENDING" || salary.paidAt) {
      return NextResponse.json(
        { error: "Only pending (unpaid) salaries can be deleted" },
        { status: 400 }
      );
    }

    // If referral bonuses were already processed/paid against this salary, don't allow deletion.
    const hasPaidReferrals = salary.referrals.some((r) => r.paidAt);
    if (hasPaidReferrals) {
      return NextResponse.json(
        { error: "Cannot delete salary with processed referral bonuses" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Remove any unprocessed referral links (if any exist)
      if (salary.referrals.length > 0) {
        await tx.referral.updateMany({
          where: { salaryId: id, paidAt: null },
          data: { salaryId: null },
        });
      }

      // Delete installments then salary
      await tx.advancePaymentInstallment.deleteMany({ where: { salaryId: id } });
      await tx.salary.delete({ where: { id } });
    });

    // Log the deletion
    await logEntityActivity(
      ActivityType.SALARY_DELETED,
      session.user.id!,
      "Salary",
      salary.id,
      `Deleted salary for ${format(new Date(salary.year, salary.month - 1), "MMMM yyyy")}`,
      { month: salary.month, year: salary.year, netSalary: salary.netSalary, userId: salary.userId },
      _req
    );

    return NextResponse.json({ message: "Salary deleted successfully" });
  } catch (error) {
    console.error("Error deleting salary:", error);
    return NextResponse.json({ error: "Failed to delete salary" }, { status: 500 });
  }
}

