import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from "@/auth";

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

    // Build update data
    const updateData = {
      role: undefined,
      status: undefined,
      branchId: undefined,
      approvedById: ''
    };
    
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    if (branchId) updateData.branchId = branchId;

    // Only set approvedById if status is being set to ACTIVE and approver exists
    if (status === 'ACTIVE' && approver) {
      updateData.approvedById = approver.id;
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

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error approving user:', error);
    return NextResponse.json(
      { error: 'Failed to approve user' },
      { status: 500 }
    );
  }
} 
