'use client'

import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FileDropzone } from '@/components/ui/file-dropzone'
import { Download, AlertCircle } from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface UserRow {
  id: string
  numId: number
  name: string | null
  salary: number | null
  optInPT: boolean
  optInPF: boolean
  optInESI: boolean
}

interface ImportError {
  rowIndex: number
  uid: string
  error: string
}

export function DeductionSettingsPage() {
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [importErrors, setImportErrors] = useState<ImportError[]>([])
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/users/deduction-settings/export')
      if (!res.ok) throw new Error('Failed to load')
      setRows(await res.json())
    } catch (e) {
      toast.error('Failed to load users')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function handleDownload() {
    const data = rows.map(r => ({
      'UID': r.id,
      'Employee Number': r.numId,
      'Name': r.name ?? '',
      'Salary': r.salary ?? '',
      'PT*': r.optInPT ? 'Y' : 'N',
      'PF*': r.optInPF ? 'Y' : 'N',
      'Insurance*': r.optInESI ? 'Y' : 'N',
    }))
    const sheet = XLSX.utils.json_to_sheet(data)
    sheet['!cols'] = [
      { wch: 28, hidden: true },
      { wch: 16 }, { wch: 24 }, { wch: 12 },
      { wch: 6 }, { wch: 6 }, { wch: 6 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, sheet, 'Deduction Settings')
    XLSX.writeFile(wb, `deduction-settings-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  async function handleUpload(uploadFile: File) {
    setUploading(true)
    setImportErrors([])
    try {
      const buf = await uploadFile.arrayBuffer()
      const wb = XLSX.read(buf)
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const parsed = XLSX.utils.sheet_to_json(sheet) as Array<Record<string, unknown>>
      const res = await fetch('/api/users/deduction-settings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed }),
      })
      const result = await res.json()
      if (!res.ok || !result.ok) {
        setImportErrors(result.errors ?? [{ rowIndex: -1, uid: '', error: result.error ?? 'Unknown error' }])
        setShowErrorDialog(true)
        return
      }
      toast.success(`Updated ${result.updated} users`)
      setFile(null)
      await load()
    } catch (err) {
      toast.error('Upload failed')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Statutory Deduction Settings</h1>
          <p className="text-sm text-muted-foreground">
            Per-employee opt-ins for Professional Tax (PT), Provident Fund (PF), and Insurance.
            PF is not yet active.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={handleDownload} variant="outline">
            <Download className="w-4 h-4 mr-2" />Download Excel
          </Button>
          <div className="flex flex-col gap-2">
            <FileDropzone
              accept=".xlsx,.xls"
              variant="file"
              value={file ? [file] : []}
              onFiles={(fs) => setFile(fs[0] ?? null)}
              onRemoveFile={() => setFile(null)}
              idleText="Drag & drop an Excel file, or click to browse"
              hint=".xlsx or .xls"
              disabled={uploading}
            />
            <Button
              onClick={() => { if (file) handleUpload(file) }}
              disabled={!file || uploading}
              variant="outline"
            >
              {uploading ? 'Uploading…' : 'Import Excel'}
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Emp #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Salary</TableHead>
              <TableHead>PT</TableHead>
              <TableHead>PF</TableHead>
              <TableHead>Insurance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.numId}</TableCell>
                <TableCell>{r.name ?? '—'}</TableCell>
                <TableCell>{r.salary ?? '—'}</TableCell>
                <TableCell>{r.optInPT ? 'Y' : 'N'}</TableCell>
                <TableCell>{r.optInPF ? 'Y' : 'N'}</TableCell>
                <TableCell>{r.optInESI ? 'Y' : 'N'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import errors</DialogTitle>
            <DialogDescription>
              No changes were saved. Fix the errors below and re-upload.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>{importErrors.length} row(s) had errors</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                {importErrors.map((e, i) => (
                  <li key={i}>
                    {e.rowIndex >= 0 ? `Row ${e.rowIndex + 2}` : 'File'}: {e.uid && `UID ${e.uid} — `}{e.error}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    </div>
  )
}
