import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { hasAccess } from '@/lib/access-control';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId } = params;
    const { signature, agreement } = await request.json();

    // Validate required fields
    if (!signature || !agreement) {
      return NextResponse.json(
        { error: 'Signature and agreement are required' },
        { status: 400 }
      );
    }

    // Get the user to be signed
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has already signed
    if (user.joiningFormSignedAt) {
      return NextResponse.json(
        { error: 'Joining form has already been signed' },
        { status: 400 }
      );
    }

    // Check permissions - user can sign their own form or HR/Management can sign for others
    const isOwnForm = session.user.id === userId;
    // @ts-expect-error - role is not defined in the session type
    const canManageUsers = hasAccess(session.user.role, "users.manage");

    if (!isOwnForm && !canManageUsers) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update user with signature information
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        joiningFormSignedAt: new Date(),
        joiningFormSignedBy: session.user.id,
        joiningFormSignature: signature,
        joiningFormAgreement: true,
      },
    });

    return NextResponse.json({
      message: 'Joining form signed successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        joiningFormSignedAt: updatedUser.joiningFormSignedAt,
      },
    });
  } catch (error) {
    console.error('Error signing joining form:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId } = params;

    // Get the user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        joiningFormSignedAt: true,
        joiningFormSignedBy: true,
        joiningFormAgreement: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permissions
    const isOwnForm = session.user.id === userId;
    // @ts-expect-error - role is not defined in the session type
    const canManageUsers = hasAccess(session.user.role, "users.manage");

    if (!isOwnForm && !canManageUsers) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      signed: !!user.joiningFormSignedAt,
      signedAt: user.joiningFormSignedAt,
      signedBy: user.joiningFormSignedBy,
      agreement: user.joiningFormAgreement,
    });
  } catch (error) {
    console.error('Error getting signature status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 