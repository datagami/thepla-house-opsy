import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-expect-error - role is not in the User type
    const canManageJobOffers = ['HR', 'MANAGEMENT'].includes(session.user.role);
    if (!canManageJobOffers) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Get job offer
    const jobOffer = await prisma.jobOffer.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!jobOffer) {
      return NextResponse.json(
        { error: 'Job offer not found' },
        { status: 404 }
      );
    }

    if (jobOffer.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Job offer is not in pending status' },
        { status: 400 }
      );
    }

    // Update job offer status to ACCEPTED
    const updatedJobOffer = await prisma.jobOffer.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobileNo: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Update user status to PENDING (they need to fill in additional details)
    await prisma.user.update({
      where: { id: jobOffer.userId },
      data: {
        status: 'PENDING',
        salary: jobOffer.totalSalary,
        title: jobOffer.designation,
        departmentId: jobOffer.departmentId,
        doj: jobOffer.joiningDate || new Date(),
      },
    });

    return NextResponse.json(updatedJobOffer);
  } catch (error) {
    console.error('Error accepting job offer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
