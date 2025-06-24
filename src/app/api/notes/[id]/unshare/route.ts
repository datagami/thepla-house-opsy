import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const note = await prisma.note.findUnique({
    where: { id: id },
    include: { sharedWith: true },
  });
  if (!note || note.isDeleted) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }
  if (note.ownerId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { userIds } = await req.json();
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: 'userIds must be a non-empty array' }, { status: 400 });
  }
  await prisma.noteShare.deleteMany({
    where: {
      noteId: note.id,
      userId: { in: userIds },
    },
  });
  const updatedNote = await prisma.note.findUnique({
    where: { id: id },
    include: { sharedWith: true },
  });
  return NextResponse.json(updatedNote);
} 
