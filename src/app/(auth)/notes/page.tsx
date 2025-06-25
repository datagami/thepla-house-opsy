import { Suspense } from 'react';
import NotesList from '../../../components/notes/NotesList';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NotesPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Notes</h1>
        <Button asChild>
          <Link href="/notes/new">+ New Note</Link>
        </Button>
      </div>
      <Suspense fallback={<div>Loading notes...</div>}>
        <NotesList />
      </Suspense>
    </div>
  );
} 
