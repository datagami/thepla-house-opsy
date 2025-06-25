"use client";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {Note} from "@/models/models";
import RichTextEditor, { RichTextEditorHandle } from "../rich-text-editor/rich-text-editor";
import {Textarea} from "@/components/ui/textarea";

export default function NoteDetail({ note }: { note: Note }) {
  const [title, setTitle] = useState(note.title);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [tab, setTab] = useState<'comments' | 'history'>('comments');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);

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

  useEffect(() => {
    if (tab === 'comments') {
      setCommentsLoading(true);
      setCommentsError(null);
      fetch(`/api/notes/${note.id}/comments`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch comments');
          return res.json();
        })
        .then(data => setComments(data))
        .catch(err => setCommentsError(err.message))
        .finally(() => setCommentsLoading(false));
    }
  }, [tab, note.id]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setAddingComment(true);
    try {
      const res = await fetch(`/api/notes/${note.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment }),
      });
      if (!res.ok) throw new Error('Failed to add comment');
      const comment = await res.json();
      setComments([comment, ...comments]);
      setNewComment("");
    } catch (err: any) {
      setCommentsError(err.message);
    } finally {
      setAddingComment(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
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
            <div>
              {commentsLoading ? (
                <div>Loading comments...</div>
              ) : commentsError ? (
                <div className="text-red-500">{commentsError}</div>
              ) : (
                <>
                  <div className="mb-2">
                    <Textarea
                      className="w-full border rounded p-2 mb-2"
                      rows={2}
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      disabled={addingComment}
                    />
                    <Button onClick={handleAddComment} disabled={addingComment || !newComment.trim()}>
                      {addingComment ? 'Adding...' : 'Add Comment'}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {comments.length === 0 ? (
                      <div className="text-muted-foreground">No comments yet.</div>
                    ) : (
                      comments.map((comment, idx) => (
                        <div key={comment.id || idx} className="border rounded p-2">
                          <div className="text-sm text-muted-foreground mb-1">{comment.author?.name || 'User'} • {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}</div>
                          <div>{comment.content}</div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
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
