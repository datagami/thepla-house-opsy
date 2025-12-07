import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from "@/auth";
import { ActivityType } from '@prisma/client';
import { logTargetUserActivity } from '@/lib/services/activity-log';

export async function POST(request: Request) {
  try {
    // Check authentication and authorization
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the current user's role
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: {
        id: true,
        role: true,
        branchId: true,
        managedBranchId: true,
      }
    });

    if (!currentUser || (currentUser.role !== 'MANAGEMENT' && currentUser.role !== 'HR' && currentUser.role !== 'BRANCH_MANAGER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, branchId } = body;

    if (!userId || !branchId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user exists and get old branch info
    const userToUpdate = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    if (!userToUpdate) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Store old branch info for logging
    const oldBranchId = userToUpdate.branchId;
    const oldBranchName = userToUpdate.branch?.name || null;

    // Check if branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: branchId }
    });

    if (!branch) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      );
    }

    // For branch managers: validate they can only reassign employees from their own branch
    if (currentUser.role === 'BRANCH_MANAGER') {
      const managerBranchId = currentUser.managedBranchId || currentUser.branchId;
      
      if (!managerBranchId) {
        return NextResponse.json(
          { error: 'Branch manager must be assigned to a branch' },
          { status: 403 }
        );
      }
      
      // Check if the employee being reassigned belongs to the manager's branch
      // Allow reassigning employees from the manager's branch to any other branch
      if (userToUpdate.branchId && userToUpdate.branchId !== managerBranchId) {
        return NextResponse.json(
          { error: 'You can only reassign employees from your own branch' },
          { status: 403 }
        );
      }
    }

    // Update user's branch
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        branchId,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        branch: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    // Log the branch assignment change
    if (oldBranchId !== branchId) {
      await logTargetUserActivity(
        ActivityType.USER_BRANCH_ASSIGNED,
        currentUser.id,
        userId,
        `Assigned user ${userToUpdate.name || userToUpdate.email} from branch "${oldBranchName || 'none'}" to branch "${branch.name}"`,
        {
          userId: userId,
          oldBranchId: oldBranchId,
          newBranchId: branchId,
          oldBranchName: oldBranchName,
          newBranchName: branch.name,
        },
        request
      );
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error assigning branch:', error);
    return NextResponse.json(
      { error: 'Error assigning branch' },
      { status: 500 }
    );
  }
} 