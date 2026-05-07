'use client'

import { useState, useRef, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { X, ChevronDown } from 'lucide-react'

interface BulkImportExportProps {
  year: number
  month: number
  onImported: () => void
}

interface BulkSheetCounts {
  rows: number
  updated: number
  unchanged: number
  skipped: number
}

interface BulkRowFailure {
  rowNumber: number
  sheet: 'Active' | 'Partial Active'
  salaryId: string | null
  employeeName: string | null
  errors: string[]
}

interface BulkImportSummary {
  ok: true
  month: number
  year: number
  perSheet: {
    Active: BulkSheetCounts
    'Partial Active': BulkSheetCounts
  }
  skippedRows: BulkRowFailure[]
}

const monthLabels = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function BulkImportExport({ year, month, onImported }: BulkImportExportProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [summary, setSummary] = useState<BulkImportSummary | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    try {
      setIsExporting(true)
      const res = await fetch(`/api/salary/bulk-export?month=${month}&year=${year}`)
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? 'Export failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `salaries-${year}-${String(month).padStart(2, '0')}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  function handlePickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setPendingFile(f)
    setShowConfirm(true)
    e.target.value = ''
  }

  async function handleConfirmUpload() {
    if (!pendingFile) return
    setShowConfirm(false)
    try {
      setIsUploading(true)
      const fd = new FormData()
      fd.set('file', pendingFile)
      const res = await fetch(`/api/salary/bulk-import?month=${month}&year=${year}`, {
        method: 'POST',
        body: fd,
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(json?.error ?? 'Upload failed')
        return
      }
      setSummary(json as BulkImportSummary)
      onImported()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
      setPendingFile(null)
    }
  }

  return (
    <>
      <input
        type="file"
        accept=".xlsx"
        ref={fileInputRef}
        onChange={handlePickFile}
        className="hidden"
      />

      <Button onClick={handleExport} disabled={isExporting} variant="outline">
        {isExporting ? 'Exporting...' : 'Export Salaries'}
      </Button>

      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        variant="outline"
      >
        {isUploading ? 'Uploading...' : 'Import Salaries'}
      </Button>

      {summary && (
        <Card className="mt-4 w-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Bulk import complete</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSummary(null)}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(['Active', 'Partial Active'] as const).map((s) => {
              const c = summary.perSheet[s]
              return (
                <div key={s} className="flex justify-between">
                  <span className="font-medium">{s} sheet</span>
                  <span className="text-muted-foreground">
                    {c.rows} rows · {c.updated} updated · {c.unchanged} unchanged · {c.skipped} skipped
                  </span>
                </div>
              )
            })}

            {summary.skippedRows.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="link" className="px-0 h-auto">
                    <ChevronDown className="h-4 w-4 mr-1" />
                    View {summary.skippedRows.length} skipped row
                    {summary.skippedRows.length === 1 ? '' : 's'}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                    {summary.skippedRows.map((r) => (
                      <li key={`${r.sheet}-${r.rowNumber}`}>
                        Row {r.rowNumber} ({r.employeeName ?? 'Unknown'}, {r.sheet}):{' '}
                        {r.errors.join('; ')}
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply bulk salary changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Upload <span className="font-medium">{pendingFile?.name}</span> and apply
              changes for {monthLabels[month - 1]} {year}? Paid salaries will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFile(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpload}>Upload</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
