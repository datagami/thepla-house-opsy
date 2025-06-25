import NoteDetail from '@/components/notes/NoteDetail';
import { getNote } from '@/lib/data/notes';
import {Note, User} from '@/models/models';
import { notFound } from 'next/navigation';
import {auth} from "@/auth";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NoteDetailPage({ params }: Props) {
  const session = await auth();
  const { id } = await params;

  let note: Note | null = null;
  try {
    note = await getNote(id);
  } catch (error: any) {
    if (error.name === 'NoteNotFoundError' || error.name === 'NotAuthorizedError') {
      return notFound();
    }
    throw error;
  }

  if (!note) {
    return notFound();
  }

  return <NoteDetail note={note} user={session?.user as User} />;
} 
