import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Note } from '@/models/models';

class NoteNotFoundError extends Error {
  constructor(message = 'Note not found') {
    super(message);
    this.name = 'NoteNotFoundError';
  }
}

class NotAuthorizedError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'NotAuthorizedError';
  }
}

export async function getNote(id: string): Promise<Note | null> {
  const session = await auth();
  if (!session?.user) {
    throw new NotAuthorizedError('Unauthorized');
  }
  const userId = session.user.id;

  const note = await prisma.note.findUnique({
    where: { id: id },
    include: { sharedWith: true, owner: true },
  });

  if (!note || note.isDeleted) {
    throw new NoteNotFoundError();
  }

  if (note.ownerId !== userId && !note.sharedWith.some(s => s.userId === userId)) {
    throw new NotAuthorizedError();
  }

  return note as Note;
}

export async function updateNote(id: string, title: string, content: string) {
  const session = await auth();
  if (!session?.user) {
    throw new NotAuthorizedError('Unauthorized');
  }
  const userId = session.user.id;

  const note = await prisma.note.findUnique({ 
    where: { id: id },
    include: { sharedWith: true }
  });

  if (!note || note.isDeleted) {
    throw new NoteNotFoundError();
  }

  console.log(note);

  if (note.ownerId !== userId && !note.sharedWith.some(s => s.userId === userId)) {
    throw new NotAuthorizedError();
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

  return updatedNote;
}

export async function softDeleteNote(id: string) {
  const session = await auth();
  if (!session?.user) {
    throw new NotAuthorizedError('Unauthorized');
  }
  const userId = session.user.id;

  const note = await prisma.note.findUnique({ where: { id: id } });

  if (!note || note.isDeleted) {
    throw new NoteNotFoundError();
  }

  if (note.ownerId !== userId) {
    throw new NotAuthorizedError();
  }

  const deletedNote = await prisma.note.update({
    where: { id: id },
    data: { isDeleted: true, updatedAt: new Date() },
  });

  return deletedNote;
} 