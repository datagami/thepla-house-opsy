import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  // List notes owned by or shared with the user, not deleted
  const notes = await prisma.note.findMany({
    where: {
      isDeleted: false,
      OR: [
        { ownerId: userId },
        { sharedWith: { some: { userId } } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { title, content } = await req.json();

  if (!title || !content) {
    return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
  }

  const note = await prisma.note.create({
    data: {
      title,
      content,
      ownerId: userId as string,
      isArchived: false,
      isDeleted: false,
    },
  });

  return NextResponse.json(note, { status: 201 });
} 
