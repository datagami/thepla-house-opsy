import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const note = await prisma.note.findUnique({
    where: { id: id },
    select: { id: true, ownerId: true, isArchived: true, isDeleted: true },
  });

  if (!note || note.isDeleted) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  if (note.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updatedNote = await prisma.note.update({
    where: { id: id },
    data: { isArchived: false, updatedAt: new Date() },
  });

  return NextResponse.json(updatedNote);
} 
