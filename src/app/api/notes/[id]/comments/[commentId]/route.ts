import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function DELETE(req: NextRequest, contextPromise: Promise<{ params: { id: string, commentId: string } }>) {
  const { params } = await contextPromise;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const comment = await prisma.noteComment.findUnique({
    where: { id: params.commentId },
    include: { note: true },
  });
  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }
  if (comment.authorId !== userId && comment.note.ownerId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await prisma.noteComment.delete({ where: { id: params.commentId } });
  return NextResponse.json({ success: true });
} 