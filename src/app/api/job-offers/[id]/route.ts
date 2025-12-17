import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-expect-error - role is not in the User type
    const canViewJobOffers = ['HR', 'MANAGEMENT'].includes(session.user.role);
    if (!canViewJobOffers) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const jobOffer = await prisma.jobOffer.findUnique({
      where: { id },
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

    if (!jobOffer) {
      return NextResponse.json(
        { error: 'Job offer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(jobOffer);
  } catch (error) {
    console.error('Error fetching job offer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const body = await request.json();

    const {
      title,
      name,
      designation,
      role,
      departmentId,
      totalSalary,
      salaryComponents,
      joiningDate,
      expiresAt,
      foodAndStayProvided,
      halfDays,
      weekOff,
      notes,
    } = body;

    // Calculate totals from components if provided
    let basicPerAnnum = undefined;
    let basicPerMonth = undefined;
    let otherAllowancesPerAnnum = undefined;
    let otherAllowancesPerMonth = undefined;
    let subtotalPerAnnum = undefined;
    let subtotalPerMonth = undefined;

    if (salaryComponents && Array.isArray(salaryComponents) && salaryComponents.length > 0) {
      const basicComponent = salaryComponents.find((c: any) => 
        c.name?.toLowerCase().includes('basic')
      ) || salaryComponents[0];
      const otherComponent = salaryComponents.find((c: any, idx: number) => 
        idx > 0 && !c.name?.toLowerCase().includes('basic')
      ) || salaryComponents[1] || { perAnnum: 0, perMonth: 0 };
      
      basicPerAnnum = parseFloat(basicComponent?.perAnnum) || 0;
      basicPerMonth = parseFloat(basicComponent?.perMonth) || Math.round(basicPerAnnum / 12);
      otherAllowancesPerAnnum = parseFloat(otherComponent?.perAnnum) || 0;
      otherAllowancesPerMonth = parseFloat(otherComponent?.perMonth) || Math.round(otherAllowancesPerAnnum / 12);
      subtotalPerAnnum = salaryComponents.reduce(
        (sum: number, comp: any) => sum + (parseFloat(comp.perAnnum) || 0),
        0
      );
      subtotalPerMonth = salaryComponents.reduce(
        (sum: number, comp: any) => sum + (parseFloat(comp.perMonth) || 0),
        0
      );
    }

    // Build update data object
    const updateData: any = {
      name,
      designation,
      totalSalary: totalSalary ? parseFloat(totalSalary) : undefined,
      salaryComponents: salaryComponents || undefined,
      basicPerAnnum,
      basicPerMonth,
      otherAllowancesPerAnnum,
      otherAllowancesPerMonth,
      subtotalPerAnnum,
      subtotalPerMonth,
        joiningDate: joiningDate ? new Date(joiningDate) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        foodAndStayProvided: foodAndStayProvided !== undefined ? foodAndStayProvided : undefined,
        halfDays: halfDays !== undefined ? parseInt(halfDays) : undefined,
        weekOff: weekOff !== undefined ? parseInt(weekOff) : undefined,
        notes: notes !== undefined ? notes : undefined,
    };

    // Handle department update using relation syntax
    if (departmentId !== undefined) {
      if (departmentId) {
        updateData.department = { connect: { id: departmentId } };
      } else {
        updateData.department = { disconnect: true };
      }
    }

    const jobOffer = await prisma.jobOffer.update({
      where: { id },
      data: updateData,
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

    // Update user if name, title, or role changed
    if (name || title || role) {
      await prisma.user.update({
        where: { id: jobOffer.userId },
        data: {
          name: name || undefined,
          title: title || undefined,
          role: role || undefined,
        },
      });
    }

    return NextResponse.json(jobOffer);
  } catch (error) {
    console.error('Error updating job offer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Get job offer to get userId
    const jobOffer = await prisma.jobOffer.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!jobOffer) {
      return NextResponse.json(
        { error: 'Job offer not found' },
        { status: 404 }
      );
    }

    // Delete job offer (cascade will handle user deletion if needed, but we'll keep user)
    await prisma.jobOffer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting job offer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
