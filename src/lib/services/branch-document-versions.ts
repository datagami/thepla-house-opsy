// Pure helpers for branch-document editing + file version history.
// Kept side-effect free so they can be unit-tested without a DB or Azure.

/** How many historical version FILES to retain per document (older blobs are pruned). */
export const MAX_DOCUMENT_VERSION_FILES = 5;

/** Allowed upload types — mirrors the create route's validation. */
export const DOCUMENT_ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "application/zip",
  "application/x-zip-compressed",
] as const;

export const DOCUMENT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface DocumentFieldsSnapshot {
  name: string;
  description: string | null;
  documentTypeId: string | null;
  renewalDate: Date;
  reminderDate: Date;
}

export type DocumentChangeField =
  | "name"
  | "description"
  | "documentType"
  | "renewalDate"
  | "reminderDate"
  | "file";

/**
 * Field-level diff between the stored document and an incoming edit.
 * `fileReplaced` appends "file" when the user uploaded a new file.
 */
export function computeDocumentChanges(
  current: DocumentFieldsSnapshot,
  incoming: DocumentFieldsSnapshot,
  fileReplaced: boolean
): DocumentChangeField[] {
  const changed: DocumentChangeField[] = [];
  if (current.name !== incoming.name) changed.push("name");
  if ((current.description ?? null) !== (incoming.description ?? null)) changed.push("description");
  if ((current.documentTypeId ?? null) !== (incoming.documentTypeId ?? null)) changed.push("documentType");
  if (current.renewalDate.getTime() !== incoming.renewalDate.getTime()) changed.push("renewalDate");
  if (current.reminderDate.getTime() !== incoming.reminderDate.getTime()) changed.push("reminderDate");
  if (fileReplaced) changed.push("file");
  return changed;
}

const CHANGE_LABELS: Record<DocumentChangeField, string> = {
  name: "name",
  description: "description",
  documentType: "document type",
  renewalDate: "renewal date",
  reminderDate: "reminder date",
  file: "file",
};

/** Human-readable summary for activity logs, e.g. "file, renewal date". */
export function describeDocumentChanges(fields: DocumentChangeField[]): string {
  return fields.map((f) => CHANGE_LABELS[f]).join(", ");
}

/**
 * After a new file version is added, decide which historical versions' blobs to
 * prune so that at most `max` versions still retain a file. Prunes oldest first
 * (lowest versionNumber); only versions that currently hold a file are candidates.
 * The live document's current file is NOT part of `versions` and is never pruned.
 */
export function versionsToPrune<
  T extends { versionNumber: number; filePruned: boolean; fileUrl: string | null }
>(versions: T[], max: number = MAX_DOCUMENT_VERSION_FILES): T[] {
  const withFile = versions
    .filter((v) => !v.filePruned && v.fileUrl)
    .sort((a, b) => a.versionNumber - b.versionNumber); // oldest first
  const excess = withFile.length - max;
  if (excess <= 0) return [];
  return withFile.slice(0, excess);
}
