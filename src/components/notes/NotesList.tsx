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

const CURRENT_USER_ID = "me"; // TODO: Replace with real user ID from context or props

const TABS = [
  { key: "all", label: "All" },
  { key: "created", label: "Created by Me" },
  { key: "shared", label: "Shared with Me" },
];

export default function NotesList() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    fetch("/api/notes")
      .then((res) => res.json())
      .then((data) => {
        setNotes(data);
        setLoading(false);
      });
  }, []);

  let filteredNotes = notes;
  if (tab === "created") {
    filteredNotes = notes.filter((n) => n.ownerId === CURRENT_USER_ID);
  } else if (tab === "shared") {
    filteredNotes = notes.filter((n) => n.sharedWith.some((s) => s.userId === CURRENT_USER_ID));
  }

  if (loading) return <div>Loading...</div>;
  if (!filteredNotes.length) return <div>No notes found.</div>;

  return (
    <div>
      <div className="flex gap-4 mb-4 border-b pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`px-3 py-1 rounded-t font-medium ${tab === t.key ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredNotes.map((note) => (
          <Link key={note.id} href={`/notes/${note.id}`} className="block">
            <div className="bg-card rounded shadow p-4 hover:shadow-lg transition border border-muted h-full flex flex-col justify-between">
              <div>
                <div className="font-bold text-lg mb-1 truncate">{note.title}</div>
                <div className="text-xs text-muted-foreground mb-2">Last updated: {new Date(note.updatedAt).toLocaleString()}</div>
                {note.isArchived && (
                  <span className="text-xs text-yellow-600">Archived</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
} 