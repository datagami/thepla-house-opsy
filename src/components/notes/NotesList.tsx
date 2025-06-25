"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

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

const FILTERS = [
  { key: "all", label: "All" },
  { key: "created_by_me", label: "Created by Me" },
  { key: "shared", label: "Shared with Me" },
];

export default function NotesList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const tabParam = searchParams.get("tab") || "all";
  const refreshParam = searchParams.get("refresh") || "";
  const [tab, setTab] = useState(tabParam);

  // Update tab state if tabParam changes (e.g., via browser navigation)
  useEffect(() => {
    setTab(tabParam);
  }, [tabParam]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/notes?filter=${tab}`)
      .then((res) => res.json())
      .then((data) => {
        setNotes(data);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, refreshParam]);

  return (
    <div>
      <div className="mb-4">
        <Select value={tab} onValueChange={selected => {
          const params = new URLSearchParams(Array.from(searchParams.entries()));
          params.set("tab", selected);
          router.replace(`?${params.toString()}`);
          setTab(selected);
        }}>
          <SelectTrigger className="w-56" id="notes-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map(f => (
              <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : !notes.length ? (
        <div>No notes found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => (
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
      )}
    </div>
  );
} 
