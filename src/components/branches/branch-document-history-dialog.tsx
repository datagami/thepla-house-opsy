"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, History, FileX } from "lucide-react";
import { BranchDocument, BranchDocumentVersion } from "@/models/models";
import { formatDateOnly } from "@/lib/utils";
import { computeDocumentChanges } from "@/lib/services/branch-document-versions";

interface BranchDocumentHistoryDialogProps {
  document: BranchDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toSnapshot(d: BranchDocument | BranchDocumentVersion) {
  return {
    name: d.name,
    description: d.description ?? null,
    documentTypeId: d.documentTypeId ?? null,
    renewalDate: new Date(d.renewalDate),
    reminderDate: new Date(d.reminderDate),
  };
}

const FIELD_LABELS: Record<string, string> = {
  name: "name",
  description: "description",
  documentType: "document type",
  renewalDate: "renewal date",
  reminderDate: "reminder date",
  file: "file",
};

export function BranchDocumentHistoryDialog({
  document,
  open,
  onOpenChange,
}: BranchDocumentHistoryDialogProps) {
  const versions = document?.versions ?? [];

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

          {versions.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No previous versions yet. A version is recorded each time the file is replaced.
            </p>
          )}

          {versions.map((version, i) => {
            // The state this version became: the next-newer snapshot (current doc for i=0).
            const newer = i === 0 ? document! : versions[i - 1];
            const changed = computeDocumentChanges(toSnapshot(version), toSnapshot(newer), true);
            const summary = changed.map((f) => FIELD_LABELS[f]).join(", ");
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
                  {summary ? ` · changed: ${summary}` : ""}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Held renewal {formatDateOnly(version.renewalDate)} · reminder{" "}
                  {formatDateOnly(version.reminderDate)}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
