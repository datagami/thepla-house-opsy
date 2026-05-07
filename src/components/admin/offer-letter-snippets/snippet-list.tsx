'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Snippet {
  id: string
  title: string
  category: string
  htmlBody: string
  isActive: boolean
  sortOrder: number
  updatedAt: string
}

export function SnippetList() {
  const router = useRouter()
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/offer-letter-snippets?all=true')
    const j = await res.json()
    setSnippets(j.snippets ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function toggleActive(s: Snippet) {
    const res = await fetch(`/api/offer-letter-snippets/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !s.isActive }),
    })
    if (!res.ok) {
      toast.error('Failed to update')
      return
    }
    void load()
  }

  async function doDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/offer-letter-snippets/${deleteId}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Failed to delete')
      return
    }
    toast.success('Snippet deleted')
    setDeleteId(null)
    void load()
  }

  if (loading) return <div>Loading…</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Offer Letter Snippets</h1>
        <Button onClick={() => router.push('/admin/offer-letter-snippets/new')}>
          <Plus className="h-4 w-4 mr-1" /> New Snippet
        </Button>
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-2">Title</th>
            <th>Category</th>
            <th>Sort</th>
            <th>Active</th>
            <th>Updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {snippets.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="py-2 font-medium">{s.title}</td>
              <td className="text-muted-foreground">{s.category}</td>
              <td>{s.sortOrder}</td>
              <td><Switch checked={s.isActive} onCheckedChange={() => toggleActive(s)} /></td>
              <td className="text-muted-foreground">{new Date(s.updatedAt).toLocaleDateString()}</td>
              <td className="flex gap-1 py-2">
                <Button variant="ghost" size="icon"
                  onClick={() => router.push(`/admin/offer-letter-snippets/${s.id}/edit`)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </td>
            </tr>
          ))}
          {snippets.length === 0 && (
            <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No snippets yet.</td></tr>
          )}
        </tbody>
      </table>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this snippet?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Existing offer letters that already pasted this snippet are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
