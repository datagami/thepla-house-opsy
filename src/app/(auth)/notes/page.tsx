import { Suspense } from 'react';
import NotesList from '../../../components/notes/NotesList';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NotesPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
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