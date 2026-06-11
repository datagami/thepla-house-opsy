# Asset Image — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each equipment asset a single optional primary photo — uploaded in the Add/Edit form, shown on the detail page (hero) and as a list thumbnail, and deleted on archive.

**Architecture:** Add `Equipment.imageUrl`. Reuse the existing base64→Azure Blob upload pattern (`maintenance-upload.ts`) with a new `uploadAssetImage` helper and the existing `deleteMaintenanceFiles` for cleanup. The create/update API handles upload/replace/clear; the archive (ACTIVE→RETIRED) flow deletes the image alongside maintenance blobs. UI: an image picker in the form, a hero on detail, a thumbnail in the list.

**Tech Stack:** Next.js 15, Prisma + Postgres, Azure Blob, Vitest (node), React/Tailwind. Spec: `docs/superpowers/specs/2026-06-10-asset-labeling-qr-design.md` (§2A).

**Conventions:** prisma `@/lib/prisma`; tests under `src/**/__tests__/**/*.test.ts`; client file→base64 via `@/lib/file-to-base64` (`fileToBase64`); uploads as `{ base64, contentType }` (see `maintenance-record-form.tsx`). Ignore the pre-existing `salary-create.test.ts` tsc error.

---

## File Structure

**Modified:**
- `prisma/schema.prisma` — `Equipment.imageUrl String?` (+ migration).
- `src/lib/maintenance-upload.ts` — add `uploadAssetImage`.
- `src/lib/validations/equipment.ts` — `image` on create; `image` + `removeImage` on update.
- `src/app/api/equipment/route.ts` (POST) — upload image on create.
- `src/app/api/equipment/[id]/route.ts` (PATCH) — replace/clear image; delete image in archive cleanup.
- `src/components/equipment/equipment-form.tsx` — single image picker.
- `src/app/(auth)/equipment/[id]/page.tsx` — hero image in the header card.
- `src/components/equipment/equipment-table.tsx` / `equipment-cards.tsx` — thumbnail in the Item cell.
- `src/components/equipment/archive-dialog.tsx` — include the asset image in the deleted-files count.

---

## Task 1: Schema — `Equipment.imageUrl`

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Add the field** — in `model Equipment`, after `notes String?`:

```prisma
  imageUrl         String?           @map("image_url")
```

- [ ] **Step 2: Validate**

Run: `npx prisma validate`
Expected: `valid 🚀`

- [ ] **Step 3: Create + apply migration**

Run: `npx prisma migrate dev --name add_equipment_image_url`
Expected: migration created + applied; client regenerated.
> If `migrate dev` is blocked by the known prod/kiosk drift, fall back to the additive pattern used before: write `prisma/migrations/<ts>_add_equipment_image_url/migration.sql` containing `ALTER TABLE "equipment" ADD COLUMN "image_url" TEXT;`, apply via `npx prisma db execute --file <that>.sql --schema prisma/schema.prisma`, then `npx prisma migrate resolve --applied <name>` and `npx prisma generate`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(asset-image): add Equipment.imageUrl"
```

---

## Task 2: `uploadAssetImage` helper

**Files:** Modify `src/lib/maintenance-upload.ts`; Test `src/lib/services/__tests__/asset-image-upload.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/services/__tests__/asset-image-upload.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadAssetImage } from "@/lib/maintenance-upload";

const uploadImage = vi.fn();
vi.mock("@/lib/azure-storage", () => ({
  AzureStorageService: class {
    uploadImage = uploadImage;
  },
}));

beforeEach(() => {
  uploadImage.mockReset();
  uploadImage.mockImplementation(async (_buf, fileName: string, folder: string) => `https://blob.test/${folder}/${fileName}`);
});

describe("uploadAssetImage", () => {
  it("returns null for no image", async () => {
    expect(await uploadAssetImage(null, "eq-1", "b-1")).toBeNull();
    expect(uploadImage).not.toHaveBeenCalled();
  });
  it("uploads to the asset-images folder and returns the url", async () => {
    const url = await uploadAssetImage({ base64: "data:image/jpeg;base64,QQ==", contentType: "image/jpeg" }, "eq-1", "b-1");
    expect(url).toContain("equipment/b-1/asset-images/");
    expect(url).toMatch(/\.jpg$/);
    expect(Buffer.isBuffer(uploadImage.mock.calls[0][0])).toBe(true);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run src/lib/services/__tests__/asset-image-upload.test.ts`
Expected: FAIL — `uploadAssetImage` not exported.

- [ ] **Step 3: Implement** — append to `src/lib/maintenance-upload.ts` (reuses the file's existing `decodeBase64`, `extFor`, `UploadFile`, `AzureStorageService`):

```typescript
/**
 * Uploads a single primary asset image to Azure Blob and returns its URL,
 * or null when no image is provided. Folder: equipment/{branchId}/asset-images.
 */
export async function uploadAssetImage(
  image: UploadFile | null | undefined,
  equipmentId: string,
  branchId: string
): Promise<string | null> {
  if (!image) return null;
  const azure = new AzureStorageService();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `asset-${equipmentId}-${stamp}.${extFor(image.contentType)}`;
  return azure.uploadImage(
    decodeBase64(image.base64),
    fileName,
    `equipment/${branchId}/asset-images`,
    image.contentType
  );
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run src/lib/services/__tests__/asset-image-upload.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/maintenance-upload.ts src/lib/services/__tests__/asset-image-upload.test.ts
git commit -m "feat(asset-image): uploadAssetImage helper"
```

---

## Task 3: Validation schemas

**Files:** Modify `src/lib/validations/equipment.ts`; Test `src/lib/services/__tests__/equipment-image-validations.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/services/__tests__/equipment-image-validations.test.ts
import { describe, it, expect } from "vitest";
import { equipmentCreateSchema, equipmentUpdateSchema } from "@/lib/validations/equipment";

const img = { base64: "data:image/png;base64,QQ==", contentType: "image/png" };

describe("equipment image validation", () => {
  it("accepts an optional image on create", () => {
    expect(equipmentCreateSchema.safeParse({ name: "X", category: "OTHER", branchId: "b", image: img }).success).toBe(true);
    expect(equipmentCreateSchema.safeParse({ name: "X", category: "OTHER", branchId: "b" }).success).toBe(true);
  });
  it("accepts image + removeImage on update", () => {
    expect(equipmentUpdateSchema.safeParse({ image: img }).success).toBe(true);
    expect(equipmentUpdateSchema.safeParse({ removeImage: true }).success).toBe(true);
  });
  it("rejects a malformed image object", () => {
    expect(equipmentCreateSchema.safeParse({ name: "X", category: "OTHER", branchId: "b", image: { base64: "" } }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run src/lib/services/__tests__/equipment-image-validations.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** — in `src/lib/validations/equipment.ts`, add `image` to create and `image`/`removeImage` to update. Change:

```typescript
export const equipmentCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  category: z.enum(EQUIPMENT_CATEGORIES),
  branchId: z.string().min(1, "Outlet is required"),
  location: z.string().trim().optional().nullable(),
  frequencyMonths: z.coerce.number().int().positive().nullable().optional(),
  reminderLeadDays: z.coerce.number().int().min(0).max(365).default(15),
  nextDueDate: dateStr.optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  image: uploadFile.optional().nullable(),
});

export const equipmentUpdateSchema = equipmentCreateSchema
  .omit({ branchId: true })
  .partial()
  .extend({
    status: z.enum(["ACTIVE", "RETIRED"]).optional(),
    removeImage: z.boolean().optional(),
  });
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run src/lib/services/__tests__/equipment-image-validations.test.ts`
Expected: PASS. Also confirm the existing `equipment-validations.test.ts` still passes: `npx vitest run src/lib/services/__tests__/equipment-validations.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/equipment.ts src/lib/services/__tests__/equipment-image-validations.test.ts
git commit -m "feat(asset-image): image fields on create/update schemas"
```

---

## Task 4: Create route — upload image

**Files:** Modify `src/app/api/equipment/route.ts`

- [ ] **Step 1: Implement** — in the `POST` handler, after the record is validated (`const data = parsed.data;`) and `canManageBranch` passes, upload the image and include `imageUrl` in the create. Add the import and the logic:

```typescript
import { uploadAssetImage } from "@/lib/maintenance-upload";
```

Replace the `prisma.equipment.create({ data: { … } })` call so it includes the uploaded URL. Just before the create:

```typescript
    const imageUrl = await uploadAssetImage(data.image ?? null, "new", data.branchId);
```

> `equipmentId` isn't known until after create; using `"new"` in the blob filename is fine (the filename also has a timestamp). Add `imageUrl,` to the `data: { … }` object of `prisma.equipment.create`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (ignore salary-create.test.ts).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/equipment/route.ts
git commit -m "feat(asset-image): store image on equipment create"
```

---

## Task 5: Update route — replace/clear image + archive deletion

**Files:** Modify `src/app/api/equipment/[id]/route.ts`

- [ ] **Step 1: Implement** — in the `PATCH` handler:

Add imports:
```typescript
import { uploadAssetImage, deleteMaintenanceFiles } from "@/lib/maintenance-upload";
```
(`deleteMaintenanceFiles` may already be imported for the archive block — don't double-import.)

After validation (`const d = parsed.data;`) and the branch authorization, compute the image change BEFORE the `prisma.equipment.update`:

```typescript
    // Asset image: explicit new image replaces (and deletes old); removeImage clears it.
    let imageUrlUpdate: { imageUrl: string | null } | null = null;
    if (d.image) {
      const newUrl = await uploadAssetImage(d.image, id, guardItem.branchId);
      imageUrlUpdate = { imageUrl: newUrl };
      if (guardItem.imageUrl) await deleteMaintenanceFiles([guardItem.imageUrl]);
    } else if (d.removeImage) {
      imageUrlUpdate = { imageUrl: null };
      if (guardItem.imageUrl) await deleteMaintenanceFiles([guardItem.imageUrl]);
    }
```

Add `...(imageUrlUpdate ?? {})` to the `data: { … }` object of the existing `prisma.equipment.update`.

Then, in the existing **archive (ACTIVE→RETIRED)** cleanup block, include the asset image when collecting URLs to delete and clear it. Where the block gathers record blob URLs and calls `deleteMaintenanceFiles(urls)`, add the asset image:

```typescript
      const urls = recs.flatMap((r) => [r.billUrl, ...r.photoUrls]).filter((u): u is string => !!u);
      if (guardItem.imageUrl) urls.push(guardItem.imageUrl);
```

And add `imageUrl: null` to the `updateMany`/equipment update that nulls the record references on archive — specifically null the equipment's `imageUrl` as part of the archive `prisma.equipment.update` (the one that set status RETIRED already ran; add a follow-up or include it). Implement: after the archive cleanup deletes blobs, also run:

```typescript
      if (guardItem.imageUrl) {
        await prisma.equipment.update({ where: { id }, data: { imageUrl: null } });
      }
```

> Use the handler's actual loaded-item variable name (it is `guardItem` per the records-route fix; confirm by reading the file — it's `const guardItem = guard.item!`). `guardItem` must include `imageUrl` and `branchId` (it's the full `prisma.equipment.findUnique`, so it does).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/equipment/[id]/route.ts"
git commit -m "feat(asset-image): replace/clear on update, delete on archive"
```

---

## Task 6: Form image picker

**Files:** Modify `src/components/equipment/equipment-form.tsx`

- [ ] **Step 1: Implement** — add a single optional asset-image picker. The form posts JSON; convert the picked file to base64 with `fileToBase64` (from `@/lib/file-to-base64`) and include it as `image` in the POST/PATCH body. On edit, show the existing `initial.imageUrl` as a preview with a "Remove" control that sends `removeImage: true`.

Add to the component:
```tsx
import { fileToBase64 } from "@/lib/file-to-base64";
```
Extend `EquipmentFormValues` with `imageUrl?: string | null`. Add state:
```tsx
const [imageFile, setImageFile] = useState<File | null>(null);
const [removeImage, setRemoveImage] = useState(false);
const existingImageUrl = initial?.imageUrl ?? null;
```
In the JSX (a sensible spot, e.g. above Notes), add:
```tsx
<div className="space-y-2">
  <Label htmlFor="asset-image">Asset photo (optional)</Label>
  {existingImageUrl && !imageFile && !removeImage && (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={existingImageUrl} alt="Asset" className="h-16 w-16 rounded object-cover" />
      <Button type="button" variant="ghost" size="sm" onClick={() => setRemoveImage(true)}>Remove</Button>
    </div>
  )}
  <Input
    id="asset-image"
    type="file"
    accept="image/*"
    onChange={(e) => { setImageFile(e.target.files?.[0] ?? null); setRemoveImage(false); }}
  />
  {imageFile && <p className="text-xs text-muted-foreground">{imageFile.name}</p>}
</div>
```
In the submit handler, before `fetch`, build the image payload and merge into the JSON body:
```tsx
const imagePayload = imageFile ? await fileToBase64(imageFile) : null;
// ...body: JSON.stringify({ ...form, /* existing fields */, image: imagePayload, removeImage })
```
(For create, send `image: imagePayload`; `removeImage` is harmless on create. For edit, send both.)

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean; in the browser, add an item with a photo → it persists; edit → preview shows; Remove clears it.

- [ ] **Step 3: Commit**

```bash
git add src/components/equipment/equipment-form.tsx
git commit -m "feat(asset-image): image picker in the item form"
```

---

## Task 7: Detail hero + list thumbnail + archive count

**Files:** Modify `src/app/(auth)/equipment/[id]/page.tsx`, `equipment-table.tsx`, `equipment-cards.tsx`, `archive-dialog.tsx`

- [ ] **Step 1: Detail hero** — in `[id]/page.tsx`, the header card renders a category-icon tile. When `item.imageUrl` is set, show the photo instead of (or beside) the icon tile. Replace the icon-tile block with:

```tsx
{item.imageUrl ? (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={item.imageUrl}
    alt={item.name}
    className="h-[44px] w-[44px] flex-none rounded-[11px] object-cover"
  />
) : (
  <div
    className="flex h-[44px] w-[44px] flex-none items-center justify-center rounded-[11px]"
    style={{ background: cm.bg, color: cm.fg }}
  >
    <CategoryIcon name={cm.icon} size={22} strokeWidth={2.1} />
  </div>
)}
```

- [ ] **Step 2: List thumbnail** — the list page's `rows` already map item fields; add `imageUrl: i.imageUrl` to the row shape in `src/app/(auth)/equipment/page.tsx` and to the `EquipmentRow` interface in `equipment-table.tsx`. In `equipment-table.tsx`'s Item cell and `equipment-cards.tsx`'s card, render a 28–36px thumbnail before the name when `row.imageUrl` exists, else the existing `CategoryIcon`/pill. Example for the table Item cell:

```tsx
{row.imageUrl ? (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={row.imageUrl} alt="" className="h-8 w-8 flex-none rounded object-cover" />
) : null}
```
Add `imageUrl: string | null;` to `EquipmentRow`, and pass `imageUrl` through from the page. (Do the same for `equipment-cards.tsx`'s `EquipmentCardRow`/props.)

- [ ] **Step 3: Archive count includes the image** — in `archive-dialog.tsx`, the dialog fetches the item's records to count photos/bills. The asset image lives on the equipment, not records — pass a `hasImage` prop from the trigger (table/cards/detail already have the row/item) and add it to the count copy, e.g. `{counts.photos} photo(s), {counts.bills} bill(s)${hasImage ? ", and the asset photo" : ""}`. Add `hasImage?: boolean` to `ArchiveDialog` props and thread it from the call sites (`row.imageUrl != null` / `item.imageUrl != null`).

- [ ] **Step 4: Verify** — `npx tsc --noEmit` + `npx eslint src/components/equipment "src/app/(auth)/equipment"` clean. Browser: an item with a photo shows a hero on detail and a thumbnail in the list; archiving it mentions the asset photo and removes the blob.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)/equipment/[id]/page.tsx" "src/app/(auth)/equipment/page.tsx" src/components/equipment/equipment-table.tsx src/components/equipment/equipment-cards.tsx src/components/equipment/archive-dialog.tsx
git commit -m "feat(asset-image): detail hero, list thumbnail, archive count"
```

---

## Task 8: Final verification

- [ ] **Step 1:** `npx vitest run src/lib` (asset-image-upload + image-validations green; existing suites unaffected).
- [ ] **Step 2:** `npx tsc --noEmit` clean (ignore salary-create.test.ts).
- [ ] **Step 3:** Stop the dev server, then `npm run build` → exit 0.
- [ ] **Step 4: Manual** — create an item with a photo; verify hero + thumbnail; edit to replace the photo (old blob deleted) and to remove it; archive an item with a photo (image blob deleted, `imageUrl` nulled). HR can't add/edit (read-only).
- [ ] **Step 5:** Restart the dev server.

## Done criteria
- An asset can carry one optional photo, shown on detail + list; replacing deletes the old blob; archiving deletes it; HR stays read-only; build + `src/lib` tests green.
