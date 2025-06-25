"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {Note, NoteComment, NoteEditHistory, NoteShare, User} from "@/models/models";
import {Textarea} from "@/components/ui/textarea";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import RichTextEditor from "@/components/rich-text-editor/rich-text-editor";
import { useRouter } from "next/navigation";

export default function NoteDetail({ note, user }: { note: Note, user: User }) {

  const [title, setTitle] = useState(note.title);
  const [tab, setTab] = useState<'comments' | 'history' | 'shared'>('comments');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<NoteEditHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [comments, setComments] = useState<NoteComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(note.sharedWith?.map((s: NoteShare) => s.userId) || []);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const isOwner = note.ownerId === user.id;
  const [content, setContent] = useState(note.content);
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveMessage, setArchiveMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [unarchiving, setUnarchiving] = useState(false);
  const [unarchiveError, setUnarchiveError] = useState<string | null>(null);
  const [unarchiveMessage, setUnarchiveMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

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

  useEffect(() => {
    if (shareModalOpen) {
      fetch('/api/users')
        .then(res => res.json())
        .then(data => setAllUsers(data))
        .catch(() => setAllUsers([]));
    }
  }, [shareModalOpen]);

  useEffect(() => {
    if (tab === 'shared' && allUsers.length === 0) {
      fetch('/api/users')
        .then(res => res.json())
        .then(data => setAllUsers(data))
        .catch(() => setAllUsers([]));
    }
  }, [tab, allUsers.length]);

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
      // @ts-expect-error expected error
    } catch (err: {message: string}) {
      setCommentsError(err.message);
    } finally {
      setAddingComment(false);
    }
  };

  const handleShareSubmit = async () => {
    setSharing(true);
    setShareError(null);
    try {
      const current = note.sharedWith?.map((s: NoteShare) => s.userId) || [];
      const toShare = selectedUserIds.filter(id => !current.includes(id));
      const toUnshare = current.filter(id => !selectedUserIds.includes(id));
      if (toShare.length) {
        await fetch(`/api/notes/${note.id}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: toShare }),
        });
      }
      if (toUnshare.length) {
        await fetch(`/api/notes/${note.id}/unshare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: toUnshare }),
        });
      }
      setShareModalOpen(false);
      window.location.reload();
    } catch {
      setShareError('Failed to update sharing');
    } finally {
      setSharing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete note');
      setDeleteDialogOpen(false);
      // Option 1: redirect to notes list
      router.push('/(auth)/notes');
      // Option 2: show a message (uncomment if you want to stay on page)
      // setMessage('Note deleted');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete note');
    } finally {
      setDeleting(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    setArchiveError(null);
    try {
      const res = await fetch(`/api/notes/${note.id}/archive`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to archive note');
      setArchiveMessage('Note archived!');
      // Optionally, you can redirect or update UI
    } catch (err: any) {
      setArchiveError(err.message || 'Failed to archive note');
    } finally {
      setArchiving(false);
    }
  };

  const handleUnarchive = async () => {
    setUnarchiving(true);
    setUnarchiveError(null);
    try {
      const res = await fetch(`/api/notes/${note.id}/unarchive`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to unarchive note');
      setUnarchiveMessage('Note unarchived!');
      // Optionally, you can redirect or update UI
    } catch (err: any) {
      setUnarchiveError(err.message || 'Failed to unarchive note');
    } finally {
      setUnarchiving(false);
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
        <RichTextEditor value={content} onChange={setContent} />
        <div className="flex gap-2 mt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          {isOwner && (
            <>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(true)} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
              {note.isArchived ? (
                <Button variant="outline" onClick={handleUnarchive} disabled={unarchiving}>
                  {unarchiving ? 'Unarchiving...' : 'Unarchive'}
                </Button>
              ) : (
                <Button variant="outline" onClick={handleArchive} disabled={archiving}>
                  {archiving ? 'Archiving...' : 'Archive'}
                </Button>
              )}
            </>
          )}
          {message && <span className="text-xs text-muted-foreground ml-2">{message}</span>}
          {archiveMessage && <span className="text-xs text-green-600 ml-2">{archiveMessage}</span>}
          {archiveError && <span className="text-xs text-red-500 ml-2">{archiveError}</span>}
          {deleteError && <span className="text-xs text-red-500 ml-2">{deleteError}</span>}
          {unarchiveMessage && <span className="text-xs text-green-600 ml-2">{unarchiveMessage}</span>}
          {unarchiveError && <span className="text-xs text-red-500 ml-2">{unarchiveError}</span>}
          {isOwner && (
            <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="mb-2">Share</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Share Note</DialogTitle>
                </DialogHeader>
                <Input
                  type="text"
                  className="mb-2"
                  placeholder="Search users by name..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
                <div className="max-h-64 overflow-y-auto space-y-2 my-4">
                  {allUsers.length === 0 ? (
                    <div>Loading users...</div>
                  ) : (
                    allUsers
                      .filter(user =>
                        user.name?.toLowerCase().includes(userSearch.toLowerCase())
                      )
                      .map(user => (
                        <label key={user.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedUserIds.includes(user.id)}
                            onCheckedChange={checked => {
                              if (checked) {
                                setSelectedUserIds(ids => [...ids, user.id]);
                              } else {
                                setSelectedUserIds(ids => ids.filter(id => id !== user.id));
                              }
                            }}
                            disabled={user.id === note.ownerId}
                          />
                          <span>
                          {user.name}
                            {" ("}
                            {user.branch?.name || "No Branch"}
                            {user.role ? `, ${user.role}` : ""}
                            {user.id === note.ownerId ? ", Owner" : ""}
                            {")"}
                        </span>
                        </label>
                      ))
                  )}
                </div>
                {shareError && <div className="text-red-500 mb-2">{shareError}</div>}
                <DialogFooter>
                  <Button onClick={handleShareSubmit} disabled={sharing}>
                    {sharing ? 'Saving...' : 'Save'}
                  </Button>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {/* Delete confirmation dialog */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Note</DialogTitle>
              </DialogHeader>
              <div>Are you sure you want to delete this note? This action cannot be undone.</div>
              {deleteError && <div className="text-red-500 mt-2">{deleteError}</div>}
              <DialogFooter>
                <Button onClick={handleDelete} disabled={deleting} variant="destructive">
                  {deleting ? 'Deleting...' : 'Delete'}
                </Button>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
          <button
            className={tab === 'shared' ? 'font-bold underline' : ''}
            onClick={() => setTab('shared')}
          >
            Shared With
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
          ) : tab === 'history' ? (
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
          ) : (
            <div>
              <div className="space-y-2">
                {note.sharedWith && note.sharedWith.length > 0 ? (
                  allUsers.length === 0 ? (
                    <div>Loading users...</div>
                  ) : (
                    allUsers
                      .filter(u => note.sharedWith.some(s => s.userId === u.id))
                      .map((user, idx) => (
                        <div key={user.id || idx} className="border rounded p-2 flex items-center gap-2">
                          <span className="font-medium">{user.name || 'User'}</span>
                          <span className="text-xs text-muted-foreground">
                            ({user.branch?.name || 'No Branch'}
                            {user.role ? `, ${user.role}` : ''}
                            {user.id === note.ownerId ? ', Owner' : ''})
                          </span>
                        </div>
                      ))
                  )
                ) : (
                  <div className="text-muted-foreground">Not shared with anyone.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 
