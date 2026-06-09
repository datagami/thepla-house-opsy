// src/components/equipment/bulk-import-export.tsx
"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface BulkSummary {
  ok: boolean;
  created: number;
  updated: number;
  unchanged: number;
  skipped: { row: number; name: string; errors: string[] }[];
}

export function BulkImportExport() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [summary, setSummary] = useState<BulkSummary | null>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/equipment/bulk-export");
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `equipment-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  function handlePickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!f) return;
    setPendingFile(f);
    setShowConfirm(true);
  }

  async function handleConfirmUpload() {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", pendingFile);
      const res = await fetch("/api/equipment/bulk-import", { method: "POST", body: fd });
      const json: BulkSummary & { error?: string } = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json?.error ?? "Import failed");
        return;
      }
      setSummary(json);
      setShowConfirm(false);
      setPendingFile(null);
      toast.success(`Imported: ${json.created} created, ${json.updated} updated`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          <Download size={15} className="mr-1.5" />
          {exporting ? "Exporting…" : "Export"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload size={15} className="mr-1.5" />
          Import
        </Button>
        <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handlePickFile} className="hidden" />
      </div>

      {summary && (
        <Card className="w-full max-w-md">
          <CardContent className="space-y-2 p-3 text-[13px]">
            <div>
              <strong>{summary.created}</strong> created · <strong>{summary.updated}</strong> updated ·{" "}
              <strong>{summary.unchanged}</strong> unchanged · <strong>{summary.skipped.length}</strong> skipped
            </div>
            {summary.skipped.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="text-[13px] font-medium text-red-600 hover:underline">
                  View {summary.skipped.length} skipped row(s)
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12.5px] text-muted-foreground">
                    {summary.skipped.map((s) => (
                      <li key={s.row}>
                        Row {s.row} {s.name ? `(${s.name})` : ""}: {s.errors.join("; ")}
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showConfirm} onOpenChange={(o) => { if (!o) { setShowConfirm(false); setPendingFile(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import equipment from spreadsheet?</DialogTitle>
            <DialogDescription>
              Rows with an Item ID update existing items; rows without one create new items.
              Invalid rows are skipped and reported. This does not delete anything.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={uploading} onClick={() => { setShowConfirm(false); setPendingFile(null); }}>
              Cancel
            </Button>
            <Button disabled={uploading} onClick={handleConfirmUpload}>
              {uploading ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
