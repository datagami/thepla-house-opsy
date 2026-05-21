import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from "@/auth";
import { ActivityType, UserStatus } from '@prisma/client';
import { logEntityActivity } from '@/lib/services/activity-log';

export async function POST(request: Request) {
  try {
    // Check authentication and authorization
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the current user's role
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! }
    });

    if (!currentUser || (currentUser.role !== 'MANAGEMENT' && currentUser.role !== 'HR' && currentUser.role !== 'BRANCH_MANAGER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, status } = body;

    if (!userId || !status || !Object.values(UserStatus).includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status or missing user ID' },
        { status: 400 }
      );
    }

    // Fetch the user's current status before anything else.
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const oldStatus = existingUser.status;

    // No-op transition: same status → don't run referral logic, record history, or log activity.
    if (oldStatus === status) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          branch: { select: { id: true, name: true } },
        },
      });
      return NextResponse.json(user);
    }

    // When marking user as PARTIAL_INACTIVE or INACTIVE, archive their referrals and reverse any paid bonuses.
    // This block only runs on a real status transition (no-op already returned above).
    let referralReversal: { paidCount: number; totalReversed: number } | null = null;
    if (status === 'PARTIAL_INACTIVE' || status === 'INACTIVE') {
      const referralsAsReferred = await prisma.referral.findMany({
        where: { referredUserId: userId },
        include: { salary: true }
      });

      if (referralsAsReferred.length > 0) {
        const unpaid = referralsAsReferred.filter((r) => r.paidAt === null);
        const paid = referralsAsReferred.filter((r) => r.paidAt !== null && r.salaryId !== null);

        const now = new Date();

        // Archive unpaid referrals
        if (unpaid.length > 0) {
          await prisma.referral.updateMany({
            where: { id: { in: unpaid.map((r) => r.id) } },
            data: { archivedAt: now }
          });
        }

        // Reverse paid referrals: decrement salary and unlink referral
        if (paid.length > 0) {
          await prisma.$transaction(async (tx) => {
            for (const ref of paid) {
              const amount = ref.bonusAmount ?? 0;
              if (ref.salaryId && amount > 0) {
                await tx.salary.update({
                  where: { id: ref.salaryId },
                  data: {
                    otherBonuses: { decrement: amount },
                    netSalary: { decrement: amount }
                  }
                });
              }
              await tx.referral.update({
                where: { id: ref.id },
                data: { paidAt: null, salaryId: null, archivedAt: now }
              });
            }
          });
          const totalReversed = paid.reduce((sum, r) => sum + (r.bonusAmount ?? 0), 0);
          referralReversal = { paidCount: paid.length, totalReversed };
        }

        const totalReversed = paid.reduce((sum, r) => sum + (r.bonusAmount ?? 0), 0);
        await logEntityActivity(
          ActivityType.REFERRAL_ARCHIVED,
          currentUser.id,
          'User',
          userId,
          `Archived ${referralsAsReferred.length} referral(s) and reversed bonus ₹${totalReversed} (referred user marked ${status.toLowerCase()}). If the referrer's salary was already paid, recovery may be required.`,
          {
            referredUserId: userId,
            archivedCount: referralsAsReferred.length,
            unpaidCount: unpaid.length,
            paidCount: paid.length,
            totalReversed
          },
          request
        );
      }
    }

    // Update user + record status transition in a single transaction.
    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { status: status as UserStatus },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          branch: { select: { id: true, name: true } },
        },
      });

      await tx.userStatusHistory.create({
        data: {
          userId,
          fromStatus: oldStatus,
          toStatus: status as UserStatus,
          changedById: currentUser.id,
          reason: null,
        },
      });

      return u;
    });

    // Activity log lives outside the transaction (has its own error handling).
    await logEntityActivity(
      ActivityType.USER_STATUS_CHANGED,
      currentUser.id,
      'User',
      userId,
      `Status changed from ${oldStatus} to ${status}`,
      { fromStatus: oldStatus, toStatus: status },
      request,
    );

    return NextResponse.json({
      ...updatedUser,
      ...(referralReversal && { referralReversal })
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    return NextResponse.json(
      { error: 'Error updating user status' },
      { status: 500 }
    );
  }
}
