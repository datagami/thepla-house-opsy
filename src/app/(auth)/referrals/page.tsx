import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReferralsManagement } from "@/components/referrals/referrals-management";

export const metadata: Metadata = {
  title: "Referrals - HRMS",
  description: "View all referrals and payout information",
};

export default async function ReferralsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // @ts-expect-error - role is not in the User type
  const userRole = session.user.role;

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

  // Recent referral reversals where bonus was reversed (HR may need to recover if salary was already paid)
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const reversalLogs = await prisma.activityLog.findMany({
    where: {
      activityType: "REFERRAL_ARCHIVED",
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  let recoveryReminderCount = 0;
  for (const log of reversalLogs) {
    try {
      const meta = log.metadata ? (JSON.parse(log.metadata) as { totalReversed?: number }) : null;
      if (meta?.totalReversed != null && meta.totalReversed > 0) recoveryReminderCount += 1;
    } catch {
      // ignore invalid metadata
    }
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <ReferralsManagement
        initialReferrals={referrals}
        userRole={userRole}
        recoveryReminderCount={recoveryReminderCount}
      />
    </div>
  );
}
