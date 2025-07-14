import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(req: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get('month') || '');
    const year = parseInt(searchParams.get('year') || '');

    if (!month || !year) {
      return NextResponse.json({ error: 'Month and year are required' }, { status: 400 });
    }

    // Single query: find users who do not have a salary for the given month/year
    const usersWithoutSalary = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        salary: { not: null },
        salaries: {
          none: {
            month,
            year,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(usersWithoutSalary);
  } catch (error) {
    console.error('Error fetching users without salary:', error);
    return NextResponse.json(
      { error: 'Error fetching users without salary' },
      { status: 500 }
    );
  }
} 