'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'

interface Snippet {
  id: string
  title: string
  category: string
  htmlBody: string
  sortOrder: number
}

const CATEGORY_LABELS: Record<string, string> = {
  WORKING_HOURS: 'Working Hours',
  PROBATION: 'Probation',
  LEAVE: 'Leave',
  NOTICE: 'Notice',
  DOCUMENTS: 'Documents',
  CONFIDENTIALITY: 'Confidentiality',
  OTHER: 'Other',
}

export function SnippetPanel() {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/offer-letter-snippets')
      .then((r) => r.json())
      .then((data) => setSnippets(data.snippets ?? []))
      .catch(() => setSnippets([]))
      .finally(() => setLoading(false))
  }, [])

  function copyHtml(html: string) {
    navigator.clipboard.writeText(html)
      .then(() => toast.success('Copied — paste into the editor.'))
      .catch(() => toast.error('Copy failed'))
  }

  const grouped = snippets.reduce<Record<string, Snippet[]>>((acc, s) => {
    (acc[s.category] ||= []).push(s)
    return acc
  }, {})

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Snippet Library</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {loading && <div className="text-muted-foreground">Loading…</div>}
        {!loading && snippets.length === 0 && (
          <div className="text-muted-foreground">No snippets available.</div>
        )}
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat}>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              {CATEGORY_LABELS[cat] ?? cat}
            </div>
            <ul className="space-y-1">
              {list.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span className="truncate" title={s.title}>{s.title}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => copyHtml(s.htmlBody)}
                    aria-label={`Copy ${s.title}`}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="pt-2 border-t">
          <a href="/admin/offer-letter-snippets" className="text-xs underline text-muted-foreground">
            Manage snippets →
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
