import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getNote, softDeleteNote, updateNote } from '@/lib/data/notes';

export async function GET(req: NextRequest, {params}: { params: { id: string } }) {
  const { id } = params;

  try {
    const note = await getNote(id);
    return NextResponse.json(note);
  } catch (error: any) {
    if (error.name === 'NoteNotFoundError') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.name === 'NotAuthorizedError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, {params}: { params: { id: string } }) {
  const { id } = params;
  try {
    const { title, content } = await req.json();
    if (!title && !content) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }
    const updatedNote = await updateNote(id, title, content);
    return NextResponse.json(updatedNote);
  } catch (error: any) {
    if (error.name === 'NoteNotFoundError') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.name === 'NotAuthorizedError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, {params}: { params: { id: string } }) {
  const { id } = params;
  try {
    const deletedNote = await softDeleteNote(id);
    return NextResponse.json(deletedNote);
  } catch (error: any) {
    if (error.name === 'NoteNotFoundError') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.name === 'NotAuthorizedError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 
