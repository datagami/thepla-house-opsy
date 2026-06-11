# Asset Labeling & QR — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Print 50×25mm QR labels for equipment assets (2 per page, label-printer ready). Each label shows a QR (encoding the asset's URL), an outlet-prefixed tag (e.g. `CHD-0042`), name, outlet, and category. Scanning with a phone's native camera opens the asset's existing detail page (behind login).

**Architecture:** Add an outlet `code` to `Branch`; compute the asset tag from `code` + `numId`. A react-pdf service renders a 2-up label PDF (QR via the new `qrcode` dep). An auth- and outlet-scoped `GET /api/equipment/labels` returns the PDF for given ids or the caller's filtered set. Scanning reuses the existing `/equipment/[id]` page unchanged.

**Tech Stack:** Next.js 15, Prisma + Postgres, `@react-pdf/renderer` (existing dep), `qrcode` (new), Vitest (node). Spec: `docs/superpowers/specs/2026-06-10-asset-labeling-qr-design.md`.

**Conventions:** prisma `@/lib/prisma`; tests under `src/**/__tests__/**/*.test.ts`; react-pdf render→buffer pattern from `src/lib/services/leave-application-pdf.tsx` (`pdf(<Doc/>)` + portable `toBuffer`); route auth/scope from `src/app/api/equipment/bulk-export/route.ts`. Ignore the pre-existing `salary-create.test.ts` tsc error.

---

## File Structure

**Created:**
- `src/lib/asset-tag.ts` — `assetTag(code, numId, outletName)` (pure).
- `src/lib/services/equipment-label-pdf.tsx` — react-pdf 2-up label Document + `renderEquipmentLabels(labels)`.
- `src/app/api/equipment/labels/route.ts` — GET → PDF.
- tests for each.

**Modified:**
- `prisma/schema.prisma` — `Branch.code String? @unique` (+ migration).
- Branch create/edit form + API — an "Outlet code" input (Management).
- `src/components/equipment/detail-actions.tsx` — "Print label" button.
- `src/components/equipment/equipment-table.tsx` / `equipment-cards.tsx` — "Print label" row action.
- `src/app/(auth)/equipment/page.tsx` — "Print labels" button (prints the current scoped/filtered set).
- `package.json` — add `qrcode` + `@types/qrcode`.

---

## Task 1: Schema — `Branch.code`

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Add the field** — in `model Branch`, after `name String @unique`:

```prisma
  code      String?  @unique
```

- [ ] **Step 2: Validate + migrate**

Run: `npx prisma validate` → valid.
Run: `npx prisma migrate dev --name add_branch_code` → applied + client regen.
> If blocked by prod/kiosk drift, use the additive fallback: `prisma/migrations/<ts>_add_branch_code/migration.sql` with `ALTER TABLE "branches" ADD COLUMN "code" TEXT; CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");`, apply via `prisma db execute`, `migrate resolve --applied`, `prisma generate`.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(asset-label): add Branch.code (outlet code)"
```

---

## Task 2: `asset-tag.ts`

**Files:** Create `src/lib/asset-tag.ts`; Test `src/lib/__tests__/asset-tag.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/asset-tag.test.ts
import { describe, it, expect } from "vitest";
import { assetTag } from "@/lib/asset-tag";

describe("assetTag", () => {
  it("uses the outlet code + zero-padded numId", () => {
    expect(assetTag("CHD", 42, "Chandivali")).toBe("CHD-0042");
    expect(assetTag("CHD", 7, "Chandivali")).toBe("CHD-0007");
  });
  it("does not truncate numIds with 5+ digits", () => {
    expect(assetTag("CHD", 12345, "Chandivali")).toBe("CHD-12345");
  });
  it("falls back to a 3-letter uppercased code from the name when code is null", () => {
    expect(assetTag(null, 42, "Chandivali")).toBe("CHA-0042");
    expect(assetTag(null, 42, "ab")).toBe("AB-0042"); // shorter names: use what's there
    expect(assetTag("", 42, "Powai West")).toBe("POW-0042"); // empty code → fallback
  });
  it("strips non-alphanumerics from the fallback", () => {
    expect(assetTag(null, 1, "S.V. Road")).toBe("SVR-0001");
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run src/lib/__tests__/asset-tag.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
// src/lib/asset-tag.ts
/** Derive a 3-letter fallback code from an outlet name (alphanumerics, uppercased). */
function fallbackCode(outletName: string): string {
  const letters = outletName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return letters.slice(0, 3) || "AST";
}

/**
 * Human-readable asset tag: `‹outlet code›-‹numId padded to 4›` (e.g. "CHD-0042").
 * Falls back to a 3-letter code derived from the outlet name when `code` is unset.
 */
export function assetTag(
  code: string | null | undefined,
  numId: number,
  outletName: string
): string {
  const prefix = code && code.trim() ? code.trim().toUpperCase() : fallbackCode(outletName);
  return `${prefix}-${String(numId).padStart(4, "0")}`;
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run src/lib/__tests__/asset-tag.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/asset-tag.ts src/lib/__tests__/asset-tag.test.ts
git commit -m "feat(asset-label): assetTag helper"
```

---

## Task 3: Outlet code on the Branch form/API

**Files:** Modify the branch create/edit form + its API route + the branch validation (under `src/components/branches`/`branch` and `src/app/api/branches`)

- [ ] **Step 1: Read the existing branch form + API** — find the branch create/edit form component and the `POST`/`PATCH` (or `PUT`) branch API. Note how `name`/`city`/`state`/`address` are validated and written (zod or inline).

- [ ] **Step 2: Add an "Outlet code" field** following the SAME pattern:
  - Form: an `<Input>` labeled "Outlet code" (short, e.g. maxLength 5), value `code`. Hint text: "Short code used on asset labels, e.g. CHD".
  - Validation: `code: z.string().trim().max(5).optional().nullable()` (or inline trim/length check); uppercase it before saving (`code?.trim().toUpperCase() || null`).
  - API: include `code` in the create/update `data` (it's `@unique`, so on a duplicate the Prisma error should surface as a clean 400 — catch the unique-violation and return a "That outlet code is already in use" message, mirroring how the branch route handles the existing `name` unique constraint).
  - Gate: only MANAGEMENT edits branches (existing branch-route permission — unchanged).

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; in the browser as Management, set an outlet's code (e.g. "CHD"); a duplicate code is rejected with a clear message.

- [ ] **Step 4: Commit**

```bash
git add src/components/branch* "src/app/api/branches" "src/app/(auth)/branches"
git commit -m "feat(asset-label): outlet code field on branches"
```

---

## Task 4: Label PDF service (+ qrcode)

**Files:** Create `src/lib/services/equipment-label-pdf.tsx`; Test `src/lib/services/__tests__/equipment-label-pdf.test.ts`; modify `package.json`

- [ ] **Step 1: Add the dependency**

Run: `npm install qrcode && npm install -D @types/qrcode`
Expected: both land in `package.json`.

- [ ] **Step 2: Write the failing render smoke test**

```typescript
// src/lib/services/__tests__/equipment-label-pdf.test.ts
import { describe, it, expect } from "vitest";
import { renderEquipmentLabels, type LabelInput } from "@/lib/services/equipment-label-pdf";

function label(over: Partial<LabelInput> = {}): LabelInput {
  return { tag: "CHD-0042", name: "KOT PC", outlet: "Chandivali", category: "Electrical", url: "https://app.test/equipment/eq-1", ...over };
}

describe("renderEquipmentLabels", () => {
  it("renders a non-empty PDF for one label", async () => {
    const buf = await renderEquipmentLabels([label()]);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
  it("handles 2 and an odd count (3) without throwing", async () => {
    expect((await renderEquipmentLabels([label(), label({ tag: "CHD-0002" })])).subarray(0, 5).toString()).toBe("%PDF-");
    expect((await renderEquipmentLabels([label(), label(), label()])).subarray(0, 5).toString()).toBe("%PDF-");
  });
  it("returns a valid (empty) PDF for no labels", async () => {
    const buf = await renderEquipmentLabels([]);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
```

- [ ] **Step 3: Run → fail**

Run: `npx vitest run src/lib/services/__tests__/equipment-label-pdf.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

```tsx
// src/lib/services/equipment-label-pdf.tsx
import { Document, Page, Text, View, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import QRCode from "qrcode";

export interface LabelInput {
  tag: string;
  name: string;
  outlet: string;
  category: string;
  url: string; // encoded in the QR
}

const MM = 2.834645669; // points per mm
const LABEL_W = 50 * MM;
const LABEL_H = 25 * MM;
const GUTTER = 2 * MM;
const QR = 20 * MM;
const PAGE: [number, number] = [2 * LABEL_W + GUTTER, LABEL_H];

const styles = StyleSheet.create({
  page: { flexDirection: "row", backgroundColor: "#FFFFFF" },
  cell: { width: LABEL_W, height: LABEL_H, flexDirection: "row", alignItems: "center", padding: 3 },
  gutter: { width: GUTTER },
  qr: { width: QR, height: QR, marginRight: 4 },
  col: { flex: 1, justifyContent: "center" },
  tag: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#111" },
  name: { fontSize: 7, color: "#111", marginTop: 1 },
  meta: { fontSize: 6, color: "#555", marginTop: 1 },
});

function Cell({ item, qrDataUrl }: { item: LabelInput; qrDataUrl: string }) {
  return (
    <View style={styles.cell}>
      <Image src={qrDataUrl} style={styles.qr} />
      <View style={styles.col}>
        <Text style={styles.tag}>{item.tag}</Text>
        <Text style={styles.name} wrap={false}>{item.name}</Text>
        <Text style={styles.meta} wrap={false}>{item.outlet}</Text>
        <Text style={styles.meta} wrap={false}>{item.category}</Text>
      </View>
    </View>
  );
}

/** Group into pairs for 2-up pages. */
function pairs<T>(arr: T[]): [T, T?][] {
  const out: [T, T?][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push([arr[i], arr[i + 1]]);
  return out;
}

export async function renderEquipmentLabels(items: LabelInput[]): Promise<Buffer> {
  // Pre-generate QR data URLs (async) before the sync render.
  const qr = await Promise.all(
    items.map((it) => QRCode.toDataURL(it.url, { margin: 0, width: 240, errorCorrectionLevel: "M" }))
  );
  const withQr = items.map((it, i) => ({ it, qrDataUrl: qr[i] }));

  const doc = (
    <Document title="Asset Labels">
      {/* Always render at least one (blank) page so an empty set is a valid PDF. */}
      {withQr.length === 0 ? (
        <Page size={PAGE} style={styles.page} />
      ) : (
        pairs(withQr).map((pair, idx) => (
          <Page key={idx} size={PAGE} style={styles.page}>
            <Cell item={pair[0].it} qrDataUrl={pair[0].qrDataUrl} />
            <View style={styles.gutter} />
            {pair[1] ? <Cell item={pair[1].it} qrDataUrl={pair[1].qrDataUrl} /> : <View style={styles.cell} />}
          </Page>
        ))
      )}
    </Document>
  );

  // Portable render→Buffer (same approach as leave-application-pdf.tsx).
  const instance = pdf(doc);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyInstance = instance as any;
  if (typeof anyInstance.toBuffer === "function") {
    const out = await anyInstance.toBuffer();
    if (Buffer.isBuffer(out)) return out;
    if (out && typeof out.on === "function") {
      return await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        out.on("data", (c: Buffer) => chunks.push(c));
        out.on("end", () => resolve(Buffer.concat(chunks)));
        out.on("error", (e: Error) => reject(e));
      });
    }
  }
  const blob: Blob = await anyInstance.toBlob();
  return Buffer.from(new Uint8Array(await blob.arrayBuffer()));
}
```

- [ ] **Step 5: Run → pass**

Run: `npx vitest run src/lib/services/__tests__/equipment-label-pdf.test.ts`
Expected: PASS (4 cases). If `pdf().toBuffer()` is slow, the test may take a couple seconds — that's fine.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/equipment-label-pdf.tsx src/lib/services/__tests__/equipment-label-pdf.test.ts package.json package-lock.json
git commit -m "feat(asset-label): 2-up 50x25mm QR label PDF (qrcode + react-pdf)"
```

---

## Task 5: Labels API route

**Files:** Create `src/app/api/equipment/labels/route.ts`; Test `src/app/api/equipment/labels/__tests__/route.test.ts`

- [ ] **Step 1: Implement**

```typescript
// src/app/api/equipment/labels/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { equipmentWhereForRole } from "@/lib/maintenance-access";
import { assetTag } from "@/lib/asset-tag";
import { renderEquipmentLabels, type LabelInput } from "@/lib/services/equipment-label-pdf";
import { categoryLabel } from "@/lib/equipment-display";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_LABELS = 1000;
type SessionUser = { id?: string; role?: string; branchId?: string | null };

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  const role = user.role ?? "";
  if (!hasAccess(role, "equipment.manage"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");
  const ids = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : null;
  const category = searchParams.get("category") ?? undefined;
  const outlet = searchParams.get("outlet") ?? undefined;
  const lifecycle = searchParams.get("lifecycle") ?? "active";

  const where = {
    ...equipmentWhereForRole(role, user.branchId ?? null), // scope is always AND-ed → no cross-outlet leak
    ...(ids ? { id: { in: ids } } : {}),
    ...(category ? { category: category as never } : {}),
    ...(outlet && (role === "HR" || role === "MANAGEMENT") ? { branchId: outlet } : {}),
    ...(lifecycle === "inactive" ? { status: "RETIRED" as const } : lifecycle === "all" ? {} : { status: "ACTIVE" as const }),
  };

  const items = await prisma.equipment.findMany({
    where,
    select: { id: true, name: true, numId: true, category: true, branch: { select: { name: true, code: true } } },
    orderBy: [{ branch: { name: "asc" } }, { numId: "asc" }],
    take: MAX_LABELS,
  });

  if (items.length === 0)
    return NextResponse.json({ error: "No assets to label" }, { status: 400 });

  const appUrl = (process.env.NEXTAUTH_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  const labels: LabelInput[] = items.map((i) => ({
    tag: assetTag(i.branch.code, i.numId, i.branch.name),
    name: i.name,
    outlet: i.branch.name,
    category: categoryLabel(i.category),
    url: `${appUrl}/equipment/${i.id}`,
  }));

  const buffer = await renderEquipmentLabels(labels);
  const today = new Date().toISOString().slice(0, 10);
  const scope = role === "BRANCH_MANAGER" ? "outlet" : "all";
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="asset-labels-${scope}-${today}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
```

- [ ] **Step 2: Write the DB-integration test** (mirrors `src/app/api/equipment/__tests__/route.test.ts`)

```typescript
// src/app/api/equipment/labels/__tests__/route.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "@/app/api/equipment/labels/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const BR_A = "__test_lbl_a", BR_B = "__test_lbl_b";

let itemA = "", itemB = "";
beforeEach(async () => {
  await prisma.branch.upsert({ where: { id: BR_A }, update: {}, create: { id: BR_A, name: "__test_lbl_A", code: "TLA", city: "X", state: "Y" } });
  await prisma.branch.upsert({ where: { id: BR_B }, update: {}, create: { id: BR_B, name: "__test_lbl_B", code: "TLB", city: "X", state: "Y" } });
  await prisma.user.upsert({ where: { id: "__test_lbl_mgr" }, update: {}, create: { id: "__test_lbl_mgr", name: "__test_lbl_mgr", email: "__test_lbl_mgr@x.test", role: "BRANCH_MANAGER", status: "ACTIVE", branchId: BR_A } });
  itemA = (await prisma.equipment.create({ data: { name: "__test_lbl_inA", category: "OTHER", branchId: BR_A, reminderLeadDays: 15, createdById: "__test_lbl_mgr" } })).id;
  itemB = (await prisma.equipment.create({ data: { name: "__test_lbl_inB", category: "OTHER", branchId: BR_B, reminderLeadDays: 15, createdById: "__test_lbl_mgr" } })).id;
});
afterEach(async () => {
  await prisma.equipment.deleteMany({ where: { name: { startsWith: "__test_lbl_" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "__test_lbl_" } } });
  await prisma.branch.deleteMany({ where: { name: { startsWith: "__test_lbl_" } } });
  vi.resetAllMocks();
});
function asManager() { authMock.mockResolvedValue({ user: { id: "__test_lbl_mgr", role: "BRANCH_MANAGER", branchId: BR_A } }); }

describe("GET /api/equipment/labels", () => {
  it("returns a PDF for the manager's own item", async () => {
    asManager();
    const res = await GET(new Request(`http://t/api/equipment/labels?ids=${itemA}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });
  it("drops another outlet's item from scope → 400 when only it is requested", async () => {
    asManager();
    const res = await GET(new Request(`http://t/api/equipment/labels?ids=${itemB}`));
    expect(res.status).toBe(400);
  });
  it("forbids HR", async () => {
    authMock.mockResolvedValue({ user: { id: "__test_lbl_mgr", role: "HR", branchId: null } });
    const res = await GET(new Request(`http://t/api/equipment/labels?ids=${itemA}`));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 3: Run**

Run: `npx vitest run src/app/api/equipment/labels/__tests__/route.test.ts`
Expected: PASS (needs the dev DB).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/equipment/labels/route.ts src/app/api/equipment/labels/__tests__/route.test.ts
git commit -m "feat(asset-label): labels PDF route (scoped, ids/filter)"
```

---

## Task 6: Print buttons (detail, row, list)

**Files:** Modify `src/components/equipment/detail-actions.tsx`, `equipment-table.tsx`, `equipment-cards.tsx`, `src/app/(auth)/equipment/page.tsx`

- [ ] **Step 1: Detail "Print label"** — in `detail-actions.tsx` (gated on `canManage`), add a button that opens the single-label PDF in a new tab:

```tsx
import { Printer } from "lucide-react";
// ...within the canManage actions:
<Button variant="outline" size="sm" asChild>
  <a href={`/api/equipment/labels?ids=${equipmentId}`} target="_blank" rel="noopener noreferrer">
    <Printer size={15} className="mr-1.5" />
    Print label
  </a>
</Button>
```

- [ ] **Step 2: Row "Print label"** — in `equipment-table.tsx` and `equipment-cards.tsx` row menus (the dropdown that already has Snooze/Mark inactive, gated by `canManage`/`canLog`), add an item:

```tsx
<DropdownMenuItem asChild>
  <a href={`/api/equipment/labels?ids=${row.id}`} target="_blank" rel="noopener noreferrer">Print label</a>
</DropdownMenuItem>
```
(Gate on `canManage`.)

- [ ] **Step 3: List "Print labels"** — in `src/app/(auth)/equipment/page.tsx`, next to Export/Import (the `canManage` block), add a button that prints the **current filtered/scoped view** by forwarding the current search params. Since the page is a server component, render a small client wrapper or an `<a>` built from `searchParams`. Simplest: a link built server-side from the already-awaited `searchParams`:

```tsx
// build a query string from the current filter params (outlet/category/lifecycle)
const labelQs = new URLSearchParams(
  Object.entries({ outlet: sp.outlet, category: sp.category, lifecycle: sp.lifecycle })
    .filter(([, v]) => !!v) as [string, string][]
).toString();
// ...in the header actions, inside {canManage && (...)}:
<Button variant="outline" size="sm" asChild>
  <a href={`/api/equipment/labels${labelQs ? `?${labelQs}` : ""}`} target="_blank" rel="noopener noreferrer">
    <Printer size={15} className="mr-1.5" />
    Print labels
  </a>
</Button>
```
(Import `Printer` and `Button`/`Link` as available; match the existing header markup.)

- [ ] **Step 4: Verify** — `npx tsc --noEmit` + eslint clean. Browser: from an asset → "Print label" opens a 1-label PDF; from the list → "Print labels" opens a multi-page PDF for the current filter; a row's "Print label" works. Open the PDF and confirm 2 labels/page at ~50×25mm with QR + `CHD-0042` + name/outlet/category. Scan a printed (or on-screen) QR with a phone → after login, lands on that asset's detail page.

- [ ] **Step 5: Commit**

```bash
git add src/components/equipment/detail-actions.tsx src/components/equipment/equipment-table.tsx src/components/equipment/equipment-cards.tsx "src/app/(auth)/equipment/page.tsx"
git commit -m "feat(asset-label): print-label actions (detail, row, list)"
```

---

## Task 7: Final verification

- [ ] **Step 1:** `npx vitest run src/lib src/app/api/equipment` (asset-tag, label-pdf, labels route green).
- [ ] **Step 2:** `npx tsc --noEmit` clean; `npm run lint` (no new warnings in touched files).
- [ ] **Step 3:** Stop dev server; `npm run build` → exit 0; confirm `/api/equipment/labels` compiled.
- [ ] **Step 4: Manual** — set an outlet code; print single + bulk labels; verify 2-up 50×25mm layout, tag format `CHD-0042`, and that scanning opens the asset page (login-gated, outlet-scoped). HR/Employee → 403 on the route; managers limited to their outlet.
- [ ] **Step 5:** Restart dev server.

## Done criteria
- Managers/Management print 2-up 50×25mm QR labels (tag + name + outlet + category) for an asset, a row, or the current filtered set; scanning opens the asset's detail page after login; outlet scope enforced; `src/lib` + labels-route tests green; build exit 0.
