"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, History, FileX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BranchDocument, BranchDocumentVersion } from "@/models/models";
import { formatDateOnly } from "@/lib/utils";

interface BranchDocumentHistoryDialogProps {
  branchId: string;
  document: BranchDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Snapshot = Pick<
  BranchDocument | BranchDocumentVersion,
  "name" | "description" | "documentTypeId" | "renewalDate" | "reminderDate"
>;

/** Human-readable old→new transitions between a version and the state it became. */
function describeTransition(older: Snapshot, newer: Snapshot, fileReplaced: boolean): string[] {
  const out: string[] = [];
  if (fileReplaced) out.push("file replaced");
  if (older.name !== newer.name) out.push(`name: “${older.name}” → “${newer.name}”`);
  if (
    new Date(older.renewalDate).getTime() !== new Date(newer.renewalDate).getTime()
  )
    out.push(`renewal ${formatDateOnly(older.renewalDate)} → ${formatDateOnly(newer.renewalDate)}`);
  if (
    new Date(older.reminderDate).getTime() !== new Date(newer.reminderDate).getTime()
  )
    out.push(`reminder ${formatDateOnly(older.reminderDate)} → ${formatDateOnly(newer.reminderDate)}`);
  if ((older.description ?? null) !== (newer.description ?? null)) out.push("description updated");
  if ((older.documentTypeId ?? null) !== (newer.documentTypeId ?? null)) out.push("document type changed");
  return out;
}

export function BranchDocumentHistoryDialog({
  branchId,
  document,
  open,
  onOpenChange,
}: BranchDocumentHistoryDialogProps) {
  const [versions, setVersions] = useState<BranchDocumentVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !document) return;
    let cancelled = false;
    setIsLoading(true);
    fetch(`/api/branches/${branchId}/documents/${document.id}/versions`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load history");
        return r.json();
      })
      .then((data: BranchDocumentVersion[]) => {
        if (!cancelled) setVersions(data);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) {
          setVersions([]);
          toast.error("Failed to load version history");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, branchId, document]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version history
          </DialogTitle>
          <DialogDescription>
            {document ? document.name : ""} — file replacements, newest first.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {/* Current live version */}
          {document && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge>Current</Badge>
                  <span className="text-sm font-medium">{document.fileName}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(document.fileUrl, "_blank")}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Renewal {formatDateOnly(document.renewalDate)} · Reminder{" "}
                {formatDateOnly(document.reminderDate)}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading history…
            </div>
          )}

          {!isLoading && versions.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No previous versions yet. A version is recorded each time the file is replaced.
            </p>
          )}

          {!isLoading &&
            versions.map((version, i) => {
              // The state this version became: the next-newer snapshot (current doc for i=0).
              const newer = i === 0 ? document! : versions[i - 1];
              const transitions = describeTransition(version, newer, true);
              return (
                <div key={version.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">v{version.versionNumber}</Badge>
                      <span className="text-sm font-medium">{version.fileName}</span>
                    </div>
                    {version.filePruned || !version.fileUrl ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <FileX className="h-3.5 w-3.5" />
                        File no longer retained
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(version.fileUrl!, "_blank")}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Download
                      </Button>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Replaced by {version.changedBy?.name ?? "Unknown"} on{" "}
                    {formatDateOnly(version.createdAt)}
                  </div>
                  {transitions.length > 0 && (
                    <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                      {transitions.map((t, idx) => (
                        <li key={idx}>{t}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
