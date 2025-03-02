import {NextResponse} from 'next/server';
import {hash} from 'bcrypt';
import {prisma} from '@/lib/prisma';
import {UserRole, UserStatus} from '@prisma/client';
import {auth} from "@/auth";

export async function POST(request: Request) {
  try {
    // Check if user is authenticated and has permission
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401});
    }

    // Get the current user's role
    const currentUser = await prisma.user.findUnique({
      where: {email: session.user.email!}
    });

    if (!currentUser || (currentUser.role !== 'MANAGEMENT' && currentUser.role !== 'HR')) {
      return NextResponse.json({error: 'Forbidden'}, {status: 403});
    }

    const body = await request.json();
    const {email, name, password, role, branchId, status = 'ACTIVE'} = body;

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
    if (currentUser.role === 'HR' && role === 'MANAGEMENT') {
      return NextResponse.json(
        {error: 'HR cannot create MANAGEMENT users1'},
        {status: 403}
      );
    }

    // Hash password
    const hashedPassword = await hash(password, 10);

    // Create new user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: role as UserRole,
        status: status as UserStatus,
        branchId,
        approvedById: currentUser.id,
      }
    });

    // Remove password from response
    const userWithoutPassword = {...user};
    userWithoutPassword.password = 'abc';


    return NextResponse.json(userWithoutPassword);
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
