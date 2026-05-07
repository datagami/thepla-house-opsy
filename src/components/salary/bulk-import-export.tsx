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

export function BulkImportExport({ year, month, onImported }: BulkImportExportProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [summary, setSummary] = useState<BulkImportSummary | null>(null)
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

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const monthLabels = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ]

  function handlePickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setPendingFile(f)
    setShowConfirm(true)
    // reset input so the same file can be picked again later
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
      <div className="flex gap-2 items-center">
        <Button onClick={handleExport} disabled={isExporting} variant="outline">
          {isExporting ? 'Exporting...' : 'Export Salaries'}
        </Button>

        <input
          type="file"
          accept=".xlsx"
          ref={fileInputRef}
          onChange={handlePickFile}
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          variant="outline"
        >
          {isUploading ? 'Uploading...' : 'Import Salaries'}
        </Button>
      </div>

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
