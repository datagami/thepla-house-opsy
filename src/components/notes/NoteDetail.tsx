"use client";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {Note} from "@/models/models";
import RichTextEditor, { RichTextEditorHandle } from "../rich-text-editor/rich-text-editor";

export default function NoteDetail({ note }: { note: Note }) {
  const [title, setTitle] = useState(note.title);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [tab, setTab] = useState<'comments' | 'history'>('comments');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const content = editorRef.current?.getContent();

    const res = await fetch(`/api/notes/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    if (res.ok) {
      setMessage('Saved!');
    } else {
      setMessage('Failed to save');
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-4">
        <input
          className="w-full text-2xl font-bold mb-2 bg-transparent border-b border-muted focus:outline-none"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <RichTextEditor ref={editorRef} initialContent={note.content} />
        <div className="flex gap-2 mt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          {message && <span className="text-xs text-muted-foreground ml-2">{message}</span>}
        </div>
      </div>
      <div className="border-t pt-4 mt-6">
        <div className="flex gap-4 mb-2">
          <button
            className={tab === 'comments' ? 'font-bold underline' : ''}
            onClick={() => setTab('comments')}
          >
            Comments
          </button>
          <button
            className={tab === 'history' ? 'font-bold underline' : ''}
            onClick={() => setTab('history')}
          >
            History
          </button>
        </div>
        <div>
          {tab === 'comments' ? (
            <div>Comments section (to be implemented)</div>
          ) : (
            <div>Edit history section (to be implemented)</div>
          )}
        </div>
      </div>
    </div>
  );
} 
