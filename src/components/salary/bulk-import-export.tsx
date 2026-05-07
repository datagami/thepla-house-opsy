'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

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

  return (
    <div className="flex gap-2 items-center">
      <Button onClick={handleExport} disabled={isExporting} variant="outline">
        {isExporting ? 'Exporting...' : 'Export Salaries'}
      </Button>
      {/* Import button + summary card added in next tasks */}
    </div>
  )
}
