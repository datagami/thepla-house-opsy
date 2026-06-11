'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { FileDropzone } from '@/components/ui/file-dropzone'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { X, ChevronDown, Download, MoreHorizontal, Upload, Gift } from 'lucide-react'

interface BulkImportExportProps {
  year: number
  month: number
  onImported: () => void
  onProcessReferrals: () => void
  isProcessingReferrals: boolean
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

export function BulkImportExport({
  year,
  month,
  onImported,
  onProcessReferrals,
  isProcessingReferrals,
}: BulkImportExportProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDownloadingReport, setIsDownloadingReport] = useState(false)
  const [isDownloadingNonPaidReport, setIsDownloadingNonPaidReport] = useState(false)
  const [hasSalaries, setHasSalaries] = useState(false)
  const [summary, setSummary] = useState<BulkImportSummary | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function checkSalaries() {
      try {
        const response = await fetch(`/api/salary?year=${year}&month=${month}`)
        if (!response.ok) throw new Error('Failed to fetch salary status')
        const data = await response.json()
        if (!cancelled) setHasSalaries(Array.isArray(data) && data.length > 0)
      } catch (error) {
        console.error('Error checking salaries:', error)
        if (!cancelled) setHasSalaries(false)
      }
    }
    checkSalaries()
    return () => {
      cancelled = true
    }
  }, [year, month])

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

  async function handleDownloadReport(nonPaidOnly = false) {
    const setBusy = nonPaidOnly ? setIsDownloadingNonPaidReport : setIsDownloadingReport
    const reportLabel = nonPaidOnly ? 'non-paid salary report' : 'salary report'
    const filenamePrefix = nonPaidOnly ? 'non-paid-salary-report' : 'salary-report'
    try {
      setBusy(true)
      const response = await fetch('/api/salary/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, nonPaidOnly }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to generate ${reportLabel}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filenamePrefix}-${month}-${year}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()

      toast.success(`${reportLabel.charAt(0).toUpperCase() + reportLabel.slice(1)} downloaded successfully`)
    } catch (error) {
      console.error(`Error downloading ${reportLabel}:`, error)
      toast.error(error instanceof Error ? error.message : `Failed to download ${reportLabel}`)
    } finally {
      setBusy(false)
    }
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <MoreHorizontal className="h-4 w-4" />
            More Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={isProcessingReferrals}
            onSelect={(event) => {
              event.preventDefault()
              onProcessReferrals()
            }}
          >
            <Gift className="h-4 w-4" />
            {isProcessingReferrals ? 'Processing...' : 'Process Referral Bonuses'}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!hasSalaries || isDownloadingReport}
            onSelect={(event) => {
              event.preventDefault()
              void handleDownloadReport(false)
            }}
          >
            <Download className="h-4 w-4" />
            {isDownloadingReport ? 'Downloading...' : 'Download Salary Report'}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!hasSalaries || isDownloadingNonPaidReport}
            onSelect={(event) => {
              event.preventDefault()
              void handleDownloadReport(true)
            }}
          >
            <Download className="h-4 w-4" />
            {isDownloadingNonPaidReport ? 'Downloading...' : 'Download Non-Paid Salary Report'}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isExporting}
            onSelect={(event) => {
              event.preventDefault()
              void handleExport()
            }}
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export Salaries'}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isUploading}
            onSelect={(event) => {
              event.preventDefault()
              setShowConfirm(true)
            }}
          >
            <Upload className="h-4 w-4" />
            {isUploading ? 'Uploading...' : 'Import Salaries'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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

      <AlertDialog open={showConfirm} onOpenChange={(open) => { setShowConfirm(open); if (!open) setPendingFile(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply bulk salary changes?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingFile
                ? <>Upload <span className="font-medium">{pendingFile.name}</span> and apply changes for {monthLabels[month - 1]} {year}? Paid salaries will be skipped.</>
                : <>Choose an .xlsx file to import salaries for {monthLabels[month - 1]} {year}. Paid salaries will be skipped.</>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FileDropzone
            accept=".xlsx"
            variant="file"
            value={pendingFile ? [pendingFile] : []}
            onFiles={(fs) => setPendingFile(fs[0] ?? null)}
            onRemoveFile={() => setPendingFile(null)}
            idleText="Drag & drop an .xlsx, or click to browse"
            hint="Excel .xlsx file"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFile(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpload} disabled={!pendingFile}>Upload</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
