# Branch Document Edit + File Version History — Design

**Date:** 2026-06-20
**Status:** Approved (design)

## Problem

Branch documents (`BranchDocument`) today support create / list / download / delete but **no edit**. When a document expires and is renewed, a MANAGEMENT user must delete the old entry and create a new one from scratch — losing continuity and any record of what changed. We want in-place editing, plus a version history of file replacements with an audit trail of *what changed and by whom*.

## Goals

- Edit an existing branch document in place: `name`, `description`, `documentType`, `renewalDate`, `reminderDate`, and **optionally replace the file**.
- Keep a **version history of file replacements** (who replaced it, when, the metadata it held), each historical file downloadable.
- Bounded storage: retain files for the latest **N = 5** versions; prune older blobs but keep their audit record.
- Record metadata-only edits in the existing activity log.

## Non-goals (YAGNI)

- No versioning of pure metadata/date edits (activity-log only).
- No branch-manager edit rights (view/download only, unchanged).
- No diff storage — field-level "before → after" is derived by diffing consecutive snapshots in the UI.
- No restore/rollback action in this iteration (history is read-only; download + re-upload covers it).

## Decisions (from brainstorming)

1. File on edit: **optional replace, old blob retained as a version** (not discarded).
2. Versioning trigger: **only file replacements** create a version row. Metadata-only edits update in place + log activity.
3. Retention: **keep recent N (=5)** version files; prune older blobs, keep the record.

## Data model

New model `BranchDocumentVersion` (new table `branch_document_versions`, requires migration):

```prisma
model BranchDocumentVersion {
  id             String   @id @default(cuid())
  numId          Int      @default(autoincrement()) @map("num_id")
  documentId     String   @map("document_id")
  versionNumber  Int      @map("version_number")     // 1,2,3… per file replacement
  // Snapshot of the SUPERSEDED file:
  fileName       String   @map("file_name")
  fileUrl        String?  @map("file_url")            // null once pruned by retention
  fileSize       Int      @map("file_size")
  fileType       String   @map("file_type")
  filePruned     Boolean  @default(false) @map("file_pruned")
  // Snapshot of the document metadata at the time this file was active:
  name           String
  description    String?
  renewalDate    DateTime @map("renewal_date")
  reminderDate   DateTime @map("reminder_date")
  documentTypeId String?  @map("document_type_id")
  // Audit:
  changedById    String   @map("changed_by_id")      // who performed the replacement
  createdAt      DateTime @default(now()) @map("created_at")

  document  BranchDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  changedBy User           @relation("BranchDocumentVersionChangedBy", fields: [changedById], references: [id])

  @@index([documentId])
  @@map("branch_document_versions")
}
```

`BranchDocument` gains `versions BranchDocumentVersion[]`. `User` gains the inverse relation. No other column changes to `BranchDocument`.

Constant: `MAX_DOCUMENT_VERSION_FILES = 5` (single source, easy to change).

## API

### `PATCH /api/branches/[branchId]/documents/[documentId]`
- **Auth:** MANAGEMENT only (matches create/delete).
- **Input:** FormData (carries optional file) — `name`, `description?`, `documentTypeId?`, `renewalDate`, `reminderDate`, optional `file` (PDF/JPG/PNG/GIF/ZIP, ≤10 MB — same validation as create).
- **Logic:**
  1. Load the document; verify it belongs to `branchId` (404 otherwise).
  2. Compute changed fields vs current values.
  3. **If a new file is present:**
     - Upload the new file to Azure (`branch-documents/`). Keep the old blob.
     - In a transaction: create a `BranchDocumentVersion` snapshotting the **pre-edit** file + metadata (`versionNumber` = existing count + 1, `changedById` = editor); update the live `BranchDocument` with new file fields + edited metadata.
     - **Retention:** after commit, if the number of non-pruned version files exceeds `MAX_DOCUMENT_VERSION_FILES`, delete the oldest version's blob (`deleteByUrl`), set its `fileUrl = null`, `filePruned = true`. Best-effort; a blob-delete failure is logged, not fatal.
  4. **If no file:** update the metadata fields in place. No version row.
  5. Log activity via `logActivity` with a new `ActivityType.DOCUMENT_UPDATED` (the enum currently has `DOCUMENT_UPLOADED/DELETED/EXPIRY_ALERT` but no update value — add it in the same migration), recording the changed fields, actor, document + branch.
  6. Return the updated document (with relations).
- **Failure handling:** if the new file uploaded but the DB transaction fails, delete the just-uploaded blob (mirror the maintenance-records cleanup pattern).

### History read
- The branch documents page already loads documents server-side; include `versions` (ordered `versionNumber desc`, `changedBy` selected) so the History dialog renders without an extra fetch. (No separate GET endpoint needed; add one only if history is opened lazily — deferred.)

### Delete cleanup
- Extend the existing `DELETE` route: before deleting the record, delete the current blob **and** every non-pruned version blob. Cascade removes version rows.

## UI

`src/components/branches/branch-documents-list.tsx` actions dropdown gains:
- **Edit** (MANAGEMENT) → opens the document form dialog in **edit mode**, pre-filled; dropzone labelled "Replace file (optional)". Submits FormData to the PATCH route.
- **History** (MANAGEMENT + BRANCH_MANAGER) → opens a timeline dialog.

Form reuse: refactor `branch-document-upload.tsx` into a shared form that supports **create** and **edit** modes via an optional `document` prop (one schema, file required on create / optional on edit). Keeps the two flows in sync.

History dialog (`branch-document-history.tsx`, new): newest-first list. Each entry:
`v{n} · {changed fields, e.g. "file replaced, renewal 01 Jan 2026 → 01 Jan 2027"} · {changedBy.name} · {date} · [Download]`.
Field-level transitions are derived by diffing each version snapshot against the next-newer one (or the live doc for the latest). Pruned entries show "file no longer retained" instead of a Download button.

## Permissions

| Action | Roles |
|--------|-------|
| Edit (PATCH) | MANAGEMENT |
| View history | MANAGEMENT, BRANCH_MANAGER (own branch) |
| Create / Delete | MANAGEMENT (unchanged) |

## Testing

- Unit: changed-field computation; retention prune selects the oldest non-pruned version; version number increments correctly.
- Route: PATCH with file (creates version, updates doc), PATCH without file (no version), retention prune past N, branch mismatch → 404, non-MANAGEMENT → 403, upload-then-DB-failure cleans the new blob.
- UI smoke: edit dialog pre-fills and submits; history timeline renders diffs and download links; pruned entry shows the retained-record state.

## Deployment

Adds a table **and** a new `ActivityType.DOCUMENT_UPDATED` enum value → run `prisma migrate deploy` on production (migration generated locally). Otherwise web-app deploy as usual. No Azure config change. No change to the daily expiry cron.
