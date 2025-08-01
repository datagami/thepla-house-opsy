"use client";
import {useState} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
const RichTextEditor = dynamic(() => import("@/components/rich-text-editor/rich-text-editor"), { ssr: false });

export default function NewNotePage() {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [content, setContent] = useState<string>(''); // State to store the editor content

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    if (res.ok) {
      const note = await res.json();
      router.push(`/notes/${note.id}`);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create note");
    }
    setSaving(false);
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h1 className="text-2xl font-bold mb-4">New Note</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="w-full text-xl font-semibold border-b border-muted bg-transparent focus:outline-none"
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
        />
        <div>
          <RichTextEditor value={content} onChange={setContent} />
        </div>
        <div className="flex gap-2 items-center">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Create Note"}
          </Button>
          {error && <span className="text-xs text-red-600 ml-2">{error}</span>}
        </div>
      </form>
    </div>
  );
} 
