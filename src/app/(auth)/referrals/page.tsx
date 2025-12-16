import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReferralsTable } from "@/components/referrals/referrals-table";

export const metadata: Metadata = {
  title: "Referrals - HRMS",
  description: "View all referrals and payout information",
};

export default async function ReferralsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Fetch all referrals with related data
  const referrals = await prisma.referral.findMany({
    include: {
      referrer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      referredUser: {
        select: {
          id: true,
          name: true,
          email: true,
          doj: true,
        },
      },
      salary: {
        select: {
          id: true,
          month: true,
          year: true,
          paidAt: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Referrals</h2>
      </div>

      <div className="rounded-md border">
        <ReferralsTable referrals={referrals} />
      </div>
    </div>
  );
}
