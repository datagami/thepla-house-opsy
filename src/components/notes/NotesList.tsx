"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDateOnly } from "@/lib/utils";
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
  owner: { id: string; name?: string | null };
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
              <div className="bg-white rounded-xl shadow hover:shadow-xl transition border border-gray-200 h-full flex flex-col justify-between min-h-[180px] p-4 relative group">
                <div className="flex-1 flex flex-col">
                  <div className="font-semibold text-lg mb-1 truncate" title={note.title}>{note.title}</div>
                  <div className="text-sm text-gray-700 mb-2 line-clamp-3 prose prose-sm max-w-full overflow-hidden" title={note.content.replace(/\n/g, ' ')}>
                    {note.content.match(/<[^>]+>/) ? (
                      <div
                        className="prose prose-sm max-w-full overflow-hidden"
                        style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                        dangerouslySetInnerHTML={{ __html: note.content.length > 500 ? note.content.slice(0, 500) + '…' : note.content }}
                      />
                    ) : (
                      note.content.length > 120 ? note.content.slice(0, 120) + '…' : note.content
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>By {note.owner?.name || 'Unknown'}</span>
                  <span>Created: {formatDateOnly(note.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
                  <span>Updated: {formatDateOnly(note.updatedAt)}</span>
                  {note.isArchived && (
                    <span className="text-yellow-600">Archived</span>
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
