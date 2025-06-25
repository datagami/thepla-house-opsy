import { NextRequest, NextResponse } from 'next/server';
import { getNote, softDeleteNote, updateNote } from '@/lib/data/notes';

export async function GET(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const note = await getNote(id);
    return NextResponse.json(note);
    // @ts-expect-error expected error
  } catch (error: {message: string}) {
    if (error.name === 'NoteNotFoundError') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.name === 'NotAuthorizedError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { title, content } = await req.json();
    if (!title && !content) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }
    const updatedNote = await updateNote(id, title, content);
    return NextResponse.json(updatedNote);
    // @ts-expect-error expected error
  } catch (error: {message: string; status: number}) {
    if (error.name === 'NoteNotFoundError') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.name === 'NotAuthorizedError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const deletedNote = await softDeleteNote(id);
    return NextResponse.json(deletedNote);
    // @ts-expect-error expected error
  } catch (error: {message: string; status: number}) {
    if (error.name === 'NoteNotFoundError') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.name === 'NotAuthorizedError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 
