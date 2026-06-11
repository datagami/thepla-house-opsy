# Asset Labeling & QR Tracking — Design Spec

**Date:** 2026-06-10
**Status:** Approved design, pending implementation plan
**Module:** Maintenance (Equipment items) — extends the merged module (PRs #52–55).

## 1. Purpose

Turn each equipment item into a labeled, scannable asset. Print a **50×25mm QR
label** for any device; scanning it with a phone's native camera opens that asset's
existing detail page (identity + full maintenance/service history), behind login.
This gives staff a physical → digital link to track an asset and its service record.

Each asset also carries a **primary photo** for visual identification (on its record,
not the label). Scope is intentionally narrow: **labels + scan-to-view + an asset
photo** on top of the existing equipment registry. Broader asset-management features (depreciation, assignments,
warranties, audits) are out of scope and would be separate specs.

## 2. Asset tag & outlet codes

- Add a short **`code`** field to the `Branch` model — a human-curated outlet code
  (e.g. `CHD` for Chandivali). `String?`, **`@unique`**, set by Management on the
  branch edit screen.
- The **asset tag** is **computed, not stored**:
  `assetTag = ‹outlet code›-‹numId zero-padded to 4›` → e.g. `CHD-0042`.
  - `numId` already exists on `Equipment` (sequential).
  - Items cannot move between outlets (branchId is immutable on update), so the tag
    is stable for an asset's life.
  - **Fallback** when `branch.code` is null: derive a 3-letter code from the outlet
    name (first three alphanumeric chars, uppercased), so labels still render. The UI
    surfaces a gentle "set an outlet code" hint; the fallback is not guaranteed unique
    and is only a stopgap.

## 2A. Asset image

- Add an **`imageUrl String?`** field to `Equipment` — a single, optional primary photo
  of the device.
- **Upload:** the Add/Edit Item form gets an optional image picker (single image,
  `image/*`). The browser reads it to base64 (same pattern as maintenance photos);
  on create/update it's uploaded to Azure Blob via a small helper to folder
  `equipment/‹branchId›/asset-images/`, and only the returned URL is stored in
  `imageUrl`. Replacing the image uploads the new one and (best-effort) deletes the old
  blob. Clearing it nulls `imageUrl` (and best-effort deletes the blob).
- **Display:**
  - **Detail page:** the image shown prominently in the header card (a thumbnail/hero
    beside the name + category), with a tasteful placeholder when absent.
  - **Items list:** a small thumbnail in the Item cell (desktop table + mobile card),
    with a category-icon placeholder when absent.
  - **Not** printed on the label (§3).
- **Archive cleanup:** consistent with the existing archive flow (which deletes a
  retired item's maintenance photos/bills), archiving an item also best-effort **deletes
  the asset image blob and nulls `imageUrl`**. The archive confirmation's counts include
  the asset image (e.g. "1 asset photo").

## 3. The label (50×25mm)

Layout per label (landscape 50mm wide × 25mm tall):
- **Left:** QR code, ~20×20mm, vertically centered.
- **Right column** (~26mm wide), top-to-bottom:
  - `CHD-0042` — the asset tag, **bold**, largest text.
  - Asset **name** (truncated/ellipsised to fit ~1 line).
  - Outlet **name**.
  - **Category** label (e.g. "Electrical").
- No company logo (keeps it legible at this size).
- Fonts small (≈6–9pt); the tag is the most prominent element.

## 4. QR content & scanning

- The QR encodes the **absolute URL** `‹APP_URL›/equipment/‹id›` (the cuid `id`).
  `APP_URL` comes from `NEXTAUTH_URL` (already used elsewhere) with a sane fallback.
- Scanning with the **phone's native camera** opens the browser at that URL. The
  existing **auth middleware** redirects an unauthenticated user to login, then back
  to the asset page. **Native-camera only — no in-app scanner is built.**
- The **existing `/equipment/[id]` detail page is reused unchanged**: it already shows
  identity + paginated service history and already enforces outlet scope (a
  BRANCH_MANAGER scanning another outlet's device is redirected; MANAGEMENT sees all).

## 5. Printing (react-pdf → PDF)

- Output is a **PDF** rendered with `@react-pdf/renderer` (already a dependency).
- **Page geometry:** two 50×25mm labels **side-by-side** per page → page ≈
  **100mm × 25mm** with a small (~2mm) center gutter (constant, easy to tune). Built
  for a 2-across label printer. Points: 1mm = 72/25.4 ≈ 2.8346pt (so a label is
  ≈141.7pt × 70.9pt).
- **Bulk:** items are laid out 2 per page across as many pages as needed (an odd count
  leaves the last page's second cell blank).
- **Entry points:**
  - **Single:** "Print label" on the asset **detail page** → one label.
  - **Per-row:** "Print label" in the items-list row menu → one label.
  - **Bulk:** "Print labels" on the **Items list** → labels for the **current
    filtered/scoped result set** (the user filters to what they want, then prints).
- **Endpoint:** `GET /api/equipment/labels` — auth + `hasAccess(role,
  "equipment.manage")` + outlet scope. Params:
  - `ids=a,b,c` — explicit asset ids (single/per-row/selected), **or**
  - no `ids` → the caller's full scoped set (mirrors the list/export scoping:
    BRANCH_MANAGER = own outlet, MANAGEMENT = all; honors `outlet`/`category`/
    `lifecycle` params if passed so "print current view" works).
  - Returns `application/pdf` with `Content-Disposition: attachment;
    filename="asset-labels-‹scope›-‹date›.pdf"`. A manager requesting another outlet's
    `ids` gets those rows filtered out (never another outlet's labels).
  - Reasonable cap (e.g. 1000 labels/request) to bound memory.

## 6. New / changed code

**New:**
- `src/lib/asset-tag.ts` — `assetTag(outletCode: string | null, numId: number,
  outletName: string)` → string (handles the fallback). Pure, unit-tested.
- `src/lib/services/equipment-label-pdf.tsx` — the react-pdf `Document`/label
  component + `renderEquipmentLabels(items): Promise<Buffer>` (mirrors
  `src/lib/services/leave-application-pdf.tsx`). Generates each QR as a data URL via
  the new **`qrcode`** dependency and embeds it as an `<Image>`.
- `src/app/api/equipment/labels/route.ts` — the PDF endpoint (§5).

**Modified:**
- `prisma/schema.prisma` — add `code String? @unique` to `Branch` **and `imageUrl
  String?` to `Equipment`** (one migration).
- Branch create/edit form + API — an "Outlet code" input (Management).
- `src/lib/validations/equipment.ts` — add the optional asset `image`
  (base64 upload) to create + an `imageUrl`/clear flag to update schemas.
- `src/lib/maintenance-upload.ts` — extend with `uploadAssetImage(...)` (folder
  `equipment/‹branchId›/asset-images/`); reuse `deleteMaintenanceFiles` for old-blob
  cleanup on replace/clear/archive.
- `src/app/api/equipment/route.ts` (POST) + `[id]/route.ts` (PATCH) — handle asset
  image upload on create, replace/clear on update, and **delete it in the archive
  (ACTIVE→RETIRED) cleanup** alongside the maintenance blobs.
- `src/components/equipment/equipment-form.tsx` — optional single asset-image picker.
- `src/app/(auth)/equipment/[id]/page.tsx` — show the asset image in the header card.
- `src/components/equipment/detail-actions.tsx` — a "Print label" button (gated on
  `equipment.manage`).
- `src/components/equipment/equipment-table.tsx` / `equipment-cards.tsx` — an asset
  **thumbnail** in the Item cell + a "Print label" row action.
- `src/components/equipment/archive-dialog.tsx` — include the asset image in the
  deleted-files count/copy.
- `src/app/(auth)/equipment/page.tsx` — a "Print labels" button (prints the current
  scoped/filtered set), next to Export/Import, gated on `equipment.manage`.

**Reused (unchanged):** `@react-pdf/renderer`, the `(print)`/PDF patterns, the
`/equipment/[id]` detail page, `equipmentWhereForRole`/`canManageBranch`, `hasAccess`,
`NEXTAUTH_URL`.

## 7. Dependencies

- Add **`qrcode`** (+ `@types/qrcode`) — generates QR codes as PNG/SVG data URLs
  server-side. Small, widely-used, no native build.

## 8. Testing

- **Unit (`asset-tag.ts`)**: `CHD` + `42` → `CHD-0042`; padding for ≥4-digit numIds;
  null code → 3-letter name fallback uppercased; name with short/punctuated value.
- **Unit (QR url)**: builds `‹APP_URL›/equipment/‹id›` from `NEXTAUTH_URL`.
- **Render smoke test**: `renderEquipmentLabels([...sample])` returns a non-empty
  Buffer starting with `%PDF` for 1 item, 2 items, and an odd count (3).
- **DB-integration (labels route)**: a BRANCH_MANAGER printing `ids` that include
  another outlet's asset gets only their own outlet's labels; HR/EMPLOYEE → 403; an
  empty scoped set → a clear 400 (`"No assets to label"`).
- **Asset image**: `uploadAssetImage` writes to the `asset-images` folder and returns a
  URL (mocked Azure); creating an item with an image stores `imageUrl`; replacing/
  clearing it deletes the old blob; archiving an item deletes the asset image blob and
  nulls `imageUrl` (covered in the archive test by asserting the count includes it).

## 9. Success criteria

- From an asset's page (or the list), a manager prints a 50×25mm label with the QR,
  `CHD-0042` tag, name, outlet, and category — 2 labels per page on a label printer.
- Scanning the label with a phone opens (after login) that asset's detail page with its
  service history; outlet scope is respected.
- Bulk printing produces a multi-page PDF for the current filtered/scoped set, bounded
  and outlet-scoped.
- Management can set/curate each outlet's short code; tags are unique and stable.

## 10. Out of scope (YAGNI)

In-app camera scanner; public/no-login scan pages; A4 tiled label sheets; depreciation/
warranty/assignment/audit features; QR scan analytics; barcode (non-QR) formats;
re-tagging when an item is (not) moved between outlets; **multiple asset images per
item** (only one primary photo) or the asset photo on the printed label.
