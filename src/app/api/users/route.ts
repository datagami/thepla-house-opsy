import {NextResponse} from 'next/server';
import {hash} from 'bcrypt';
import {prisma} from '@/lib/prisma';
import {auth} from "@/auth";
import { hasAccess } from "@/lib/access-control";
import { logTargetUserActivity } from "@/lib/services/activity-log";
import { ActivityType } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401});
    }

    // @ts-expect-error - role is not defined in the session type
    const canManageUsers = hasAccess(session.user.role, "users.manage");
    if (!canManageUsers) {
      return NextResponse.json({error: 'Forbidden'}, {status: 403});
    }

    const body = await request.json();
    const { 
      name, 
      email, 
      password, 
      role, 
      branchId,
      title,
      departmentId,
      mobileNo,
      doj,
      dob,
      gender,
      panNo,
      aadharNo,
      bankAccountNo,
      salary,
      references,
      referredById 
    } = body;

    if (!email || !name || !password) {
      return NextResponse.json(
        {error: 'Missing required fields'},
        {status: 400}
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: {email}
    });

    if (existingUser) {
      return NextResponse.json(
        {error: 'User already exists'},
        {status: 400}
      );
    }

    // Validate role assignment permissions
    // @ts-expect-error - role is not defined in the session type
    if (role === 'MANAGEMENT' && session.user.role !== 'MANAGEMENT') {
      return NextResponse.json(
        {error: 'MANAGEMENT users can only be created by MANAGEMENT users'},
        {status: 403}
      );
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create new user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        branchId,
        title,
        departmentId,
        mobileNo,
        doj: doj ? new Date(doj) : undefined,
        dob: dob ? new Date(dob) : undefined,
        gender,
        panNo,
        aadharNo,
        salary: parseFloat(salary),
        bankAccountNo: bankAccountNo || null,
        references: {
          create: references.map((ref: { name: string; contactNo: string }) => ({
            name: ref.name,
            contactNo: ref.contactNo,
          })),
        },
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        references: true,
      },
    });

    // If referredById provided, record a referral with eligibility at 3 months from DOJ
    if (referredById) {
      const referrer = await prisma.user.findUnique({ where: { id: referredById } });
      if (referrer) {
        const dojDate = doj ? new Date(doj) : new Date();
        const eligibleAt = new Date(dojDate);
        eligibleAt.setMonth(eligibleAt.getMonth() + 3);

        // Create referral; ignore if duplicate due to unique constraint
        await prisma.referral.upsert({
          where: {
            referrerId_referredUserId: {
              referrerId: referredById,
              referredUserId: user.id,
            },
          },
          update: {
            eligibleAt,
          },
          create: {
            referrerId: referredById,
            referredUserId: user.id,
            eligibleAt,
          },
        });
      }
    }

    // Log user creation
    // @ts-expect-error - id is not in the session type
    await logTargetUserActivity(
      ActivityType.USER_CREATED,
      session.user.id,
      user.id,
      `Created new user: ${user.name} (${user.email}) with role ${user.role}`,
      {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        role: user.role,
        branchId: user.branchId,
        departmentId: user.departmentId,
      },
      request
    );

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      {error: 'Error creating user'},
      {status: 500}
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401});
    }

    const currentUser = await prisma.user.findUnique({
      where: {email: session.user.email!}
    });

    if (!currentUser || (currentUser.role !== 'MANAGEMENT' && currentUser.role !== 'HR')) {
      return NextResponse.json({error: 'Forbidden'}, {status: 403});
    }

    // Get branch filter from URL if present
    const {searchParams} = new URL(request.url);
    const branchId = searchParams.get('branchId');

    const users = await prisma.user.findMany({
      where: {
        ...(branchId ? {branchId} : {}),
        // HR can only see non-management users1
        ...(currentUser.role === 'HR' ? {
          NOT: {role: 'MANAGEMENT'}
        } : {})
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        branch: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users1:', error);
    return NextResponse.json(
      {error: 'Error fetching users1'},
      {status: 500}
    );
  }
} 
