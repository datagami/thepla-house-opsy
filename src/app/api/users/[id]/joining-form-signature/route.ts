import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { hasAccess } from '@/lib/access-control';
import { uploadJoiningFormFiles } from '@/lib/upload-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { signature, agreement, photo } = await request.json();

    // Validate required fields
    if (!signature || !agreement || !photo) {
      return NextResponse.json(
        { error: 'Signature, agreement, and photo are required' },
        { status: 400 }
      );
    }

    // Get the user to be signed
    const user = await prisma.user.findUnique({
      where: { id: id },
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
    const isOwnForm = session.user.id === id;
    // @ts-expect-error - role is not defined in the session type
    const canManageUsers = hasAccess(session.user.role, "users.manage");

    if (!isOwnForm && !canManageUsers) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Upload signature and photo to Azure
    let signatureUrl = '';
    let photoUrl = '';
    
    try {
      const uploadResult = await uploadJoiningFormFiles(signature, photo, id);
      signatureUrl = uploadResult.signatureUrl;
      photoUrl = uploadResult.photoUrl;
    } catch (error) {
      console.error('Error uploading to Azure:', error);
      return NextResponse.json(
        { error: 'Failed to upload files to storage' },
        { status: 500 }
      );
    }

    // Update user with signature information and Azure URLs
    const updatedUser = await prisma.user.update({
      where: { id: id },
      data: {
        joiningFormSignedAt: new Date(),
        joiningFormSignedBy: session.user.id,
        joiningFormSignature: signatureUrl, // Store Azure URL instead of base64
        joiningFormAgreement: true,
        joiningFormPhoto: photoUrl, // Store Azure URL instead of base64
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get the user
    const user = await prisma.user.findUnique({
      where: { id: id },
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
    const isOwnForm = session.user.id === id;
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
