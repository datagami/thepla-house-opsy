import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    // @ts-expect-error role in session
    if (!session?.user || !["HR", "MANAGEMENT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const salary = await prisma.salary.findUnique({
      where: { id },
      include: {
        referrals: true,
      },
    });

    if (!salary) {
      return NextResponse.json({ error: "Salary not found" }, { status: 404 });
    }

    if (salary.status !== "PENDING" || salary.paidAt) {
      return NextResponse.json(
        { error: "Can only undo referral bonus for pending (unpaid) salaries" },
        { status: 400 }
      );
    }

    const referrals = salary.referrals || [];
    if (referrals.length === 0) {
      return NextResponse.json({ error: "No referral bonuses attached to this salary" }, { status: 400 });
    }

    // Only undo if these referrals were actually processed (paidAt set)
    const processedReferralIds = referrals.filter((r) => r.paidAt !== null).map((r) => r.id);
    if (processedReferralIds.length === 0) {
      return NextResponse.json({ error: "Referral bonuses are not processed for this salary" }, { status: 400 });
    }

    const total = referrals.reduce((sum, r) => sum + (r.bonusAmount || 0), 0);

    await prisma.$transaction(async (tx) => {
      // Unlink and unpay referrals so they carry over again
      await tx.referral.updateMany({
        where: { id: { in: processedReferralIds }, salaryId: id },
        data: { paidAt: null, salaryId: null },
      });

      // Reverse salary totals
      await tx.salary.update({
        where: { id },
        data: {
          otherBonuses: { decrement: total },
          netSalary: { decrement: total },
        },
      });
    });

    return NextResponse.json({ message: "Referral bonus undone", totalReversed: total });
  } catch (error) {
    console.error("Error undoing referral bonus:", error);
    return NextResponse.json({ error: "Failed to undo referral bonus" }, { status: 500 });
  }
}

