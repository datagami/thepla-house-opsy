'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { sanitizeOfferHtml } from '@/lib/services/offer-letter'

const RichTextEditor = dynamic(
  () => import('@/components/rich-text-editor/rich-text-editor'),
  { ssr: false }
)

// Snippet editor needs the Jodit "source" button so HR can paste the
// exact <section class="clause"><h3><span class="num-mark">NN</span>…</h3>
// structure that the print CSS targets. Plain WYSIWYG can't insert
// class="num-mark", so the visual numbering won't match.
const SNIPPET_EDITOR_CONFIG = {
  readonly: false,
  height: 570,
  toolbarSticky: false,
  toolbarAdaptive: false,
  showCharsCounter: false,
  showWordsCounter: false,
  showXPathInStatusbar: false,
  askBeforePasteHTML: false,
  askBeforePasteFromWord: false,
  buttons: [
    'source', '|',
    'bold', 'italic', 'underline', 'strikethrough', '|',
    'ul', 'ol', '|',
    'outdent', 'indent', '|',
    'font', 'fontsize', 'brush', 'paragraph', '|',
    'image', 'table', 'link', '|',
    'align', 'undo', 'redo', '|',
    'hr', 'eraser', 'copyformat', '|',
    'fullsize',
  ],
}

interface SnippetFormProps {
  snippet?: {
    id: string
    title: string
    category: string
    htmlBody: string
    isActive: boolean
    sortOrder: number
  }
}

const CATEGORIES = [
  'WORKING_HOURS', 'PROBATION', 'LEAVE', 'NOTICE', 'DOCUMENTS', 'CONFIDENTIALITY', 'OTHER',
]

export function SnippetForm({ snippet }: SnippetFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState(snippet?.title ?? '')
  const [category, setCategory] = useState(snippet?.category ?? 'OTHER')
  const [htmlBody, setHtmlBody] = useState(snippet?.htmlBody ?? '')
  const [isActive, setIsActive] = useState(snippet?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(snippet?.sortOrder ?? 0)
  const [saving, setSaving] = useState(false)
  const editorConfig = useMemo(() => SNIPPET_EDITOR_CONFIG, [])

  async function save() {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    setSaving(true)
    try {
      const url = snippet
        ? `/api/offer-letter-snippets/${snippet.id}`
        : '/api/offer-letter-snippets'
      const method = snippet ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, htmlBody, isActive, sortOrder }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? 'Save failed')
      }
      toast.success('Snippet saved')
      router.push('/admin/offer-letter-snippets')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Sort order</Label>
          <Input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value || '0', 10))}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <Label>Active</Label>
        </div>
        <div className="space-y-1.5">
          <Label>HTML body</Label>
          <p className="text-xs text-muted-foreground">
            Use the <strong>Source</strong> toolbar button to paste the full clause structure.
            For numbered headings to render in gold like the seeded snippets, the heading must be
            <code className="mx-1 px-1 py-0.5 bg-muted rounded text-[11px]">{`<h3><span class="num-mark">NN</span>Title</h3>`}</code>
            and the whole clause wrapped in
            <code className="mx-1 px-1 py-0.5 bg-muted rounded text-[11px]">{`<section class="clause">…</section>`}</code>.
          </p>
          <RichTextEditor value={htmlBody} onChange={setHtmlBody} config={editorConfig} />
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Preview</Label>
        <div
          className="border rounded p-4 mt-1 bg-[hsl(39_100%_97%)] text-sm"
          dangerouslySetInnerHTML={{ __html: sanitizeOfferHtml(htmlBody) }}
        />
      </div>
    </div>
  )
}
