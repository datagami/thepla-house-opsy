import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get('filter') || 'all';

  let where;
  if (filter === 'created_by_me' || filter === 'created') {
    where = {
      isDeleted: false,
      ownerId: userId,
    };
  } else if (filter === 'shared') {
    where = {
      isDeleted: false,
      ownerId: { not: userId },
      sharedWith: { some: { userId } },
    };
  } else {
    // all
    where = {
      isDeleted: false,
      OR: [
        { ownerId: userId },
        { sharedWith: { some: { userId } } },
      ],
    };
  }

  const notes = await prisma.note.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      owner: {
        select: { id: true, name: true }
      }
    }
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
