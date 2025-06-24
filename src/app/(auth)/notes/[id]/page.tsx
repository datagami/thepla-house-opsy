import NoteDetail from '@/components/notes/NoteDetail';
import { getNote } from '@/lib/data/notes';
import { Note } from '@/models/models';
import { notFound } from 'next/navigation';

interface Props {
  params: { id: string };
}

export default async function NoteDetailPage({ params }: Props) {
  const { id } = params;

  let note: Note | null = null;
  try {
    note = await getNote(id);
    console.log(note);
  } catch (error: any) {
    if (error.name === 'NoteNotFoundError' || error.name === 'NotAuthorizedError') {
      return notFound();
    }
    throw error;
  }

  if (!note) {
    return notFound();
  }

  return <NoteDetail note={note} />;
} 