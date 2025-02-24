import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {auth} from "@/auth";

export async function POST(req: Request) {
  try {
    const session = await auth();
    
    // Check if user is authorized (MANAGEMENT or HR)
    if (!session || !['MANAGEMENT', 'HR'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { userId, role, status, branchId } = await req.json();

    const updateData: any = {
      approvedById: session.user.id,
    };

    if (role) updateData.role = role;
    if (status) updateData.status = status;
    if (branchId) updateData.branchId = branchId;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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
