import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
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
  if (note.ownerId !== userId && !note.sharedWith.some(s => s.userId === userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(note);
}

export async function PUT(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const note = await prisma.note.findUnique({ where: { id: id } });
  if (!note || note.isDeleted) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }
  if (note.ownerId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { title, content } = await req.json();
  if (!title && !content) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }
  // Save edit history
  await prisma.noteEditHistory.create({
    data: {
      noteId: note.id,
      editorId: userId,
      content: note.content,
    },
  });
  // Update note
  const updatedNote = await prisma.note.update({
    where: { id: id },
    data: {
      title: title ?? note.title,
      content: content ?? note.content,
      updatedAt: new Date(),
    },
  });
  return NextResponse.json(updatedNote);
}

export async function DELETE(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const note = await prisma.note.findUnique({ where: { id: id } });
  if (!note || note.isDeleted) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }
  if (note.ownerId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const deletedNote = await prisma.note.update({
    where: { id: id },
    data: { isDeleted: true, updatedAt: new Date() },
  });
  return NextResponse.json(deletedNote);
} 
