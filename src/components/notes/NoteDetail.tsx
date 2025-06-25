"use client";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {Note} from "@/models/models";
import RichTextEditor, { RichTextEditorHandle } from "../rich-text-editor/rich-text-editor";

export default function NoteDetail({ note }: { note: Note }) {
  const [title, setTitle] = useState(note.title);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [tab, setTab] = useState<'comments' | 'history'>('comments');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

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

  useEffect(() => {
    if (tab === 'history') {
      setHistoryLoading(true);
      setHistoryError(null);
      fetch(`/api/notes/${note.id}/history`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch history');
          return res.json();
        })
        .then(data => setHistory(data))
        .catch(err => setHistoryError(err.message))
        .finally(() => setHistoryLoading(false));
    }
  }, [tab, note.id]);

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
            <div>
              {historyLoading ? (
                <div>Loading history...</div>
              ) : historyError ? (
                <div className="text-red-500">{historyError}</div>
              ) : (
                <div className="space-y-4">
                
                  {/* Edit entries */}
                  {[...history].sort((a, b) => new Date(b.editedAt).getTime() - new Date(a.editedAt).getTime()).map((h, idx) => (
                    <div key={h.id || idx} className="border rounded p-2 bg-muted/30">
                      <div className="flex flex-col gap-2">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            Edited by: {h.editor?.name || 'User'} • {h.editedAt ? new Date(h.editedAt).toLocaleString() : ''}
                          </div>
                          <div className="prose prose-sm min-h-[2rem]"
                                dangerouslySetInnerHTML={{ __html: h.content || "<span class='italic text-muted-foreground'>(empty)</span>" }}/>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 
