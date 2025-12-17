import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { hasAccess } from '@/lib/access-control';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const jobOffers = await prisma.jobOffer.findMany({
      where,
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
      orderBy: {
        offerDate: 'desc',
      },
    });

    return NextResponse.json(jobOffers);
  } catch (error) {
    console.error('Error fetching job offers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-expect-error - role is not in the User type
    const canCreateJobOffers = ['HR', 'MANAGEMENT'].includes(session.user.role);
    if (!canCreateJobOffers) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    // Validate required fields
    if (!name || !designation || !totalSalary || !title || !role || !departmentId) {
      return NextResponse.json(
        { error: 'Name, title, designation, role, department, and total salary are required' },
        { status: 400 }
      );
    }

    // Validate salary components
    if (!salaryComponents || !Array.isArray(salaryComponents) || salaryComponents.length === 0) {
      return NextResponse.json(
        { error: 'At least one salary component is required' },
        { status: 400 }
      );
    }

    // Calculate totals from components
    const calculatedTotal = salaryComponents.reduce(
      (sum: number, comp: any) => sum + (parseFloat(comp.perAnnum) || 0),
      0
    );
    
    // For backward compatibility, calculate legacy fields from first two components
    const basicComponent = salaryComponents.find((c: any) => 
      c.name?.toLowerCase().includes('basic')
    ) || salaryComponents[0];
    const otherComponent = salaryComponents.find((c: any, idx: number) => 
      idx > 0 && !c.name?.toLowerCase().includes('basic')
    ) || salaryComponents[1] || { perAnnum: 0, perMonth: 0 };
    
    const basicPerAnnum = parseFloat(basicComponent?.perAnnum) || 0;
    const basicPerMonth = parseFloat(basicComponent?.perMonth) || Math.round(basicPerAnnum / 12);
    const otherAllowancesPerAnnum = parseFloat(otherComponent?.perAnnum) || 0;
    const otherAllowancesPerMonth = parseFloat(otherComponent?.perMonth) || Math.round(otherAllowancesPerAnnum / 12);
    const subtotalPerAnnum = calculatedTotal;
    const subtotalPerMonth = salaryComponents.reduce(
      (sum: number, comp: any) => sum + (parseFloat(comp.perMonth) || 0),
      0
    );

    // Create user with JOB_OFFER status
    const user = await prisma.user.create({
      data: {
        name,
        title,
        departmentId: departmentId || null,
        status: 'JOB_OFFER',
        role: role || 'EMPLOYEE',
      },
    });

    // Create job offer
    const jobOffer = await prisma.jobOffer.create({
      data: {
        userId: user.id,
        name,
        designation,
        departmentId: departmentId || null,
        totalSalary: parseFloat(totalSalary),
        salaryComponents: salaryComponents,
        basicPerAnnum,
        basicPerMonth,
        otherAllowancesPerAnnum,
        otherAllowancesPerMonth,
        subtotalPerAnnum,
        subtotalPerMonth,
        joiningDate: joiningDate ? new Date(joiningDate) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        foodAndStayProvided: foodAndStayProvided ?? false,
        halfDays: halfDays !== undefined ? parseInt(halfDays) : 4,
        weekOff: weekOff !== undefined ? parseInt(weekOff) : 2,
        notes: notes || null,
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

    return NextResponse.json(jobOffer, { status: 201 });
  } catch (error) {
    console.error('Error creating job offer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
