import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
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
  if (note.ownerId !== userId && !note.sharedWith.some((s: { userId: string }) => s.userId === userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const comments = await prisma.noteComment.findMany({
    where: { noteId: note.id },
    orderBy: { createdAt: 'asc' },
    include: { author: true },
  });
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, {params}: { params: Promise<{ id: string}> }) {
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
  if (note.ownerId !== userId && !note.sharedWith.some((s: { userId: string }) => s.userId === userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { content } = await req.json();
  if (!content) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }
  const comment = await prisma.noteComment.create({
    data: {
      noteId: note.id,
      authorId: userId as string,
      content,
    },
    include: { author: true },
  });
  return NextResponse.json(comment, { status: 201 });
} 
