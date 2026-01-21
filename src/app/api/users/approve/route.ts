import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from "@/auth";
import { logTargetUserActivity } from "@/lib/services/activity-log";
import { ActivityType, Prisma, UserRole, UserStatus } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const session = await auth();
    
    // Check if user is authorized (MANAGEMENT or HR)
    // @ts-expect-error - role is not in the User type
    if (!session || !['MANAGEMENT', 'HR'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { userId, role, status, branchId } = await req.json();

    // First verify both users1 exist
    const [userToUpdate, approver] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
      }),
      prisma.user.findUnique({
        // @ts-expect-error - id is not in the User type
        where: { id: session.user.id },
      }),
    ]);

    if (!userToUpdate) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!approver) {
      return NextResponse.json(
        { error: 'Approver not found' },
        { status: 401 }
      );
    }

    // If status isn't provided, approving a PENDING user should activate them.
    const nextStatus = status ?? (userToUpdate.status === "PENDING" ? "ACTIVE" : undefined);

    // Build update data
    const updateData: Prisma.UserUpdateInput = {};
    
    if (role) updateData.role = role as UserRole;
    if (nextStatus) updateData.status = nextStatus as UserStatus;
    if (branchId) {
      updateData.branch = {
        connect: { id: branchId },
      };
    }

    // Only set approvedById when approving to ACTIVE.
    // (Don't send empty string / invalid FK values.)
    if (nextStatus === 'ACTIVE') {
      updateData.approvedBy = {
        connect: { id: approver.id },
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
      },
    });

    // Log user approval/status change
    const approverId = (session.user as { id?: string }).id;
    if (!approverId) {
      return NextResponse.json(updatedUser);
    }
    const changes: string[] = [];
    if (role) changes.push(`role: ${role}`);
    if (nextStatus) changes.push(`status: ${nextStatus}`);
    if (branchId) changes.push(`branchId: ${branchId}`);

    if (nextStatus === 'ACTIVE') {
      await logTargetUserActivity(
        ActivityType.USER_APPROVED,
        approverId,
        userId,
        `Approved user ${updatedUser.name} (${updatedUser.email})`,
        {
          userId,
          changes,
          approvedBy: approverId,
        },
        req
      );
    }

    if (nextStatus && nextStatus !== 'ACTIVE') {
      await logTargetUserActivity(
        ActivityType.USER_STATUS_CHANGED,
        approverId,
        userId,
        `Changed status of user ${updatedUser.name} to ${nextStatus}`,
        {
          userId,
          newStatus: nextStatus,
          changes,
        },
        req
      );
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error approving user:', error);
    return NextResponse.json(
      { error: 'Failed to approve user' },
      { status: 500 }
    );
  }
} 
