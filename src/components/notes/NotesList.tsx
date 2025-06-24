"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Note {
  id: string;
  title: string;
  content: string;
  ownerId: string;
  isArchived: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  sharedWith: { userId: string }[];
}

export default function NotesList() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notes")
      .then((res) => res.json())
      .then((data) => {
        setNotes(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!notes.length) return <div>No notes found.</div>;

  return (
    <div>
      <ul className="divide-y divide-muted">
        {notes.map((note) => (
          <li
            key={note.id}
            className="py-3 hover:bg-muted rounded px-2"
          >
            <Link href={`/notes/${note.id}`} className="block">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{note.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Last updated: {new Date(note.updatedAt).toLocaleString()}
                  </div>
                </div>
                {note.isArchived && (
                  <span className="text-xs text-yellow-600 ml-2">Archived</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
} 