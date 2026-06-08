# Maintenance Module — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** The backend plan (`2026-06-08-maintenance-module-backend.md`) is fully implemented and merged — the `/api/equipment*` routes, Prisma models, and `equipment.*` access features must exist.

**Goal:** Build the "Maintenance" UI — items registry, item detail + service history, log-maintenance form (with bill/photo upload), snooze, cost summary, and a dashboard due-soon widget — for managers (own outlet), management (all outlets), and HR (read-only).

**Architecture:** Server components (`src/app/(auth)/equipment/**`) do the `auth()` + Prisma reads and pass data to focused client components (`src/components/equipment/**`). Mutations POST JSON to the backend APIs and `router.refresh()`. UI uses the existing shadcn/ui set; toasts via `sonner`. "Equipment" is labeled **"Item"** in all UI copy; the menu is **"Maintenance"**.

**Tech Stack:** Next.js 15 App Router (server + client components), shadcn/ui (Radix), Tailwind, react-hook-form (optional), lucide-react, sonner, date-fns, Vitest (pure helpers only — no component tests in this repo).

**Conventions:**
- Page shell: `<div className="flex-1 space-y-4 p-8 pt-6">…</div>` (see `src/app/(auth)/leave-requests/new/page.tsx`).
- Server page reads role via `session.user.role` and branch via `session.user.branchId` (typed loosely with `as`).
- Available `src/components/ui/*`: `badge, button, card, dialog, dropdown-menu, input, label, select, table, tabs, textarea, date-picker, sonner` (and more).
- Toast: `import { toast } from "sonner"`.
- Currency: format with `new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })`.

---

## File Structure

**Created:**
- `src/lib/equipment-display.ts` — pure label/badge/format helpers (+ test).
- `src/app/(auth)/equipment/page.tsx` — items registry (server).
- `src/components/equipment/equipment-table.tsx` — registry table + row actions (client).
- `src/components/equipment/equipment-filters.tsx` — category/status/branch filters (client).
- `src/components/equipment/equipment-stat-cards.tsx` — overdue/due-soon/active counts.
- `src/app/(auth)/equipment/new/page.tsx` + `src/app/(auth)/equipment/[id]/edit/page.tsx` — server wrappers.
- `src/components/equipment/equipment-form.tsx` — add/edit item form (client).
- `src/app/(auth)/equipment/[id]/page.tsx` — item detail + history (server).
- `src/components/equipment/maintenance-history.tsx` — record list (client).
- `src/app/(auth)/equipment/[id]/records/new/page.tsx` — server wrapper.
- `src/components/equipment/maintenance-record-form.tsx` — log-maintenance form + uploads (client).
- `src/components/equipment/snooze-dialog.tsx` — snooze dialog (client).
- `src/app/(auth)/equipment/costs/page.tsx` — cost summary (server).
- `src/components/dashboard/maintenance-due-widget.tsx` — dashboard card (server-friendly client).
- `src/lib/file-to-base64.ts` — browser File→base64 helper.

**Modified:**
- `src/components/layout/side-nav.tsx` — add "Maintenance" entry for BRANCH_MANAGER, HR, MANAGEMENT.

---

## Task 1: Display helpers (`equipment-display.ts`)

**Files:**
- Create: `src/lib/equipment-display.ts`
- Test: `src/lib/__tests__/equipment-display.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/equipment-display.test.ts
import { describe, it, expect } from "vitest";
import { categoryLabel, maintenanceTypeLabel, formatINR, stateBadge } from "@/lib/equipment-display";

describe("labels", () => {
  it("humanizes categories and types", () => {
    expect(categoryLabel("FIRE_SAFETY")).toBe("Fire Safety");
    expect(categoryLabel("PEST_CONTROL")).toBe("Pest Control");
    expect(maintenanceTypeLabel("AMC")).toBe("AMC");
    expect(maintenanceTypeLabel("REPAIR")).toBe("Repair");
  });
});

describe("formatINR", () => {
  it("formats rupees with the ₹ symbol and no decimals", () => {
    expect(formatINR(1500)).toContain("1,500");
    expect(formatINR(1500)).toContain("₹");
  });
});

describe("stateBadge", () => {
  it("maps reminder states to label + variant", () => {
    expect(stateBadge("OVERDUE").variant).toBe("destructive");
    expect(stateBadge("DUE_SOON").label).toBe("Due Soon");
    expect(stateBadge("SNOOZED").label).toBe("Snoozed");
    expect(stateBadge("OK").label).toBe("Scheduled");
    expect(stateBadge("NONE").label).toBe("No schedule");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/equipment-display.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/equipment-display.ts
import type { ReminderState } from "@/lib/services/maintenance-schedule";

const CATEGORY_LABELS: Record<string, string> = {
  FIRE_SAFETY: "Fire Safety",
  REFRIGERATION: "Refrigeration",
  KITCHEN_EQUIPMENT: "Kitchen Equipment",
  ELECTRICAL: "Electrical",
  PLUMBING: "Plumbing",
  PEST_CONTROL: "Pest Control",
  CLEANING: "Cleaning",
  OTHER: "Other",
};

const TYPE_LABELS: Record<string, string> = {
  REPAIR: "Repair",
  SERVICE: "Service",
  AMC: "AMC",
  INSPECTION: "Inspection",
  REPLACEMENT: "Replacement",
  OTHER: "Other",
};

export function categoryLabel(c: string): string {
  return CATEGORY_LABELS[c] ?? c;
}

export function maintenanceTypeLabel(t: string): string {
  return TYPE_LABELS[t] ?? t;
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatINR(amount: number): string {
  return inr.format(amount);
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export function stateBadge(state: ReminderState): { label: string; variant: BadgeVariant } {
  switch (state) {
    case "OVERDUE":
      return { label: "Overdue", variant: "destructive" };
    case "DUE_SOON":
      return { label: "Due Soon", variant: "default" };
    case "SNOOZED":
      return { label: "Snoozed", variant: "secondary" };
    case "OK":
      return { label: "Scheduled", variant: "outline" };
    default:
      return { label: "No schedule", variant: "outline" };
  }
}

export const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/equipment-display.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/equipment-display.ts src/lib/__tests__/equipment-display.test.ts
git commit -m "feat(maintenance-ui): display helpers for labels, currency, state badges"
```

---

## Task 2: Side-nav "Maintenance" entry

**Files:**
- Modify: `src/components/layout/side-nav.tsx`

- [ ] **Step 1: Add the icon import** — in the `lucide-react` import block, add `Wrench`:

```typescript
  Wrench,
```

- [ ] **Step 2: Add the nav item to BRANCH_MANAGER** (insert after the `Attendance` entry, before `Leave Requests`):

```typescript
    {
      title: "Maintenance",
      href: "/equipment",
      icon: <Wrench className="h-5 w-5" />,
      feature: "equipment.view"
    },
```

- [ ] **Step 3: Add the nav item to HR and MANAGEMENT** — in each of those role arrays, add a top-level entry (place after the `Warnings & Compliance` group):

```typescript
    {
      title: "Maintenance",
      icon: <Wrench className="h-5 w-5" />,
      feature: "equipment.view",
      subItems: [
        {
          title: "Items",
          href: "/equipment",
          icon: <Wrench className="h-4 w-4" />,
          feature: "equipment.view"
        },
        {
          title: "Cost Summary",
          href: "/equipment/costs",
          icon: <FileText className="h-4 w-4" />,
          feature: "equipment.view"
        },
      ]
    },
```

- [ ] **Step 4: Verify in the browser**

Start the dev server (`npm run dev`) and confirm a "Maintenance" item appears in the sidebar for a manager/HR/management session and is hidden for an employee. (Use the preview verification workflow; check the rendered nav.)

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/side-nav.tsx
git commit -m "feat(maintenance-ui): add Maintenance nav entry (manager/HR/management)"
```

---

## Task 3: Items registry page + table + filters + stat cards

**Files:**
- Create: `src/app/(auth)/equipment/page.tsx`
- Create: `src/components/equipment/equipment-stat-cards.tsx`
- Create: `src/components/equipment/equipment-filters.tsx`
- Create: `src/components/equipment/equipment-table.tsx`

- [ ] **Step 1: Stat cards component**

```tsx
// src/components/equipment/equipment-stat-cards.tsx
import { Card, CardContent } from "@/components/ui/card";

export function EquipmentStatCards({
  overdue,
  dueSoon,
  active,
}: {
  overdue: number;
  dueSoon: number;
  active: number;
}) {
  const cards = [
    { label: "Overdue", value: overdue, cls: "text-red-600" },
    { label: "Due Soon", value: dueSoon, cls: "text-amber-600" },
    { label: "Active Items", value: active, cls: "text-foreground" },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className={`text-2xl font-bold ${c.cls}`}>{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Filters component** (client; updates URL search params)

```tsx
// src/components/equipment/equipment-filters.tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_CATEGORIES, categoryLabel } from "@/lib/equipment-display";

export function EquipmentFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "ALL") next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Select value={params.get("category") ?? "ALL"} onValueChange={(v) => set("category", v)}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All categories</SelectItem>
          {ALL_CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={params.get("status") ?? "ACTIVE"} onValueChange={(v) => set("status", v)}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All statuses</SelectItem>
          <SelectItem value="ACTIVE">Active</SelectItem>
          <SelectItem value="RETIRED">Retired</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 3: Table component** (client; renders rows, row actions, snooze + log shortcuts)

```tsx
// src/components/equipment/equipment-table.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { categoryLabel, stateBadge } from "@/lib/equipment-display";
import { getReminderState, daysUntil, type ReminderState } from "@/lib/services/maintenance-schedule";
import { SnoozeDialog } from "@/components/equipment/snooze-dialog";

export interface EquipmentRow {
  id: string;
  name: string;
  category: string;
  location: string | null;
  status: "ACTIVE" | "RETIRED";
  reminderLeadDays: number;
  nextDueDate: string | null;
  lastServiceDate: string | null;
  snoozedUntil: string | null;
  branch: { id: string; name: string };
}

function dueLabel(row: EquipmentRow, state: ReminderState): string {
  if (!row.nextDueDate) return "—";
  const d = daysUntil(new Date(row.nextDueDate), new Date());
  if (state === "OVERDUE") return `${format(new Date(row.nextDueDate), "dd MMM yyyy")} (${Math.abs(d)}d ago)`;
  return `${format(new Date(row.nextDueDate), "dd MMM yyyy")} (in ${d}d)`;
}

export function EquipmentTable({ rows, canManage }: { rows: EquipmentRow[]; canManage: boolean }) {
  const [snoozeId, setSnoozeId] = useState<string | null>(null);
  const today = new Date();

  if (rows.length === 0) {
    return <p className="rounded-md border border-dashed p-8 text-center text-muted-foreground">No items yet. Add your first maintenance item.</p>;
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Outlet</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Next due</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const state = getReminderState(
                {
                  nextDueDate: row.nextDueDate ? new Date(row.nextDueDate) : null,
                  reminderLeadDays: row.reminderLeadDays,
                  snoozedUntil: row.snoozedUntil ? new Date(row.snoozedUntil) : null,
                  status: row.status,
                },
                today
              );
              const badge = stateBadge(state);
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    <Link href={`/equipment/${row.id}`} className="hover:underline">{row.name}</Link>
                  </TableCell>
                  <TableCell><Badge variant="outline">{categoryLabel(row.category)}</Badge></TableCell>
                  <TableCell>{row.branch.name}</TableCell>
                  <TableCell>{row.location ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      <span className="text-xs text-muted-foreground">{dueLabel(row, state)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canManage && (
                        <>
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/equipment/${row.id}/records/new`}>Log</Link>
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setSnoozeId(row.id)}>Snooze</Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {snoozeId && <SnoozeDialog equipmentId={snoozeId} open onOpenChange={(o) => !o && setSnoozeId(null)} />}
    </>
  );
}
```

- [ ] **Step 4: Registry page** (server; reads, scopes, counts states)

```tsx
// src/app/(auth)/equipment/page.tsx
import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { equipmentWhereForRole } from "@/lib/maintenance-access";
import { getReminderState } from "@/lib/services/maintenance-schedule";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { EquipmentStatCards } from "@/components/equipment/equipment-stat-cards";
import { EquipmentFilters } from "@/components/equipment/equipment-filters";
import { EquipmentTable } from "@/components/equipment/equipment-table";

export const metadata: Metadata = { title: "Maintenance - Opsy" };

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const user = session.user as { role?: string; branchId?: string | null };
  if (!hasAccess(user.role ?? "", "equipment.view")) redirect("/dashboard");

  const sp = await searchParams;
  const where = {
    ...equipmentWhereForRole(user.role ?? "", user.branchId ?? null),
    ...(sp.category ? { category: sp.category as never } : {}),
    ...(sp.status && sp.status !== "ALL" ? { status: sp.status as never } : sp.status ? {} : { status: "ACTIVE" as never }),
  };

  const items = await prisma.equipment.findMany({
    where,
    include: { branch: { select: { id: true, name: true } } },
    orderBy: [{ nextDueDate: "asc" }, { name: "asc" }],
  });

  const today = new Date();
  let overdue = 0;
  let dueSoon = 0;
  for (const it of items) {
    const s = getReminderState(
      { nextDueDate: it.nextDueDate, reminderLeadDays: it.reminderLeadDays, snoozedUntil: it.snoozedUntil, status: it.status as "ACTIVE" | "RETIRED" },
      today
    );
    if (s === "OVERDUE") overdue++;
    else if (s === "DUE_SOON") dueSoon++;
  }

  const canManage = hasAccess(user.role ?? "", "equipment.manage");
  const rows = items.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    location: i.location,
    status: i.status as "ACTIVE" | "RETIRED",
    reminderLeadDays: i.reminderLeadDays,
    nextDueDate: i.nextDueDate ? i.nextDueDate.toISOString() : null,
    lastServiceDate: i.lastServiceDate ? i.lastServiceDate.toISOString() : null,
    snoozedUntil: i.snoozedUntil ? i.snoozedUntil.toISOString() : null,
    branch: i.branch,
  }));

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Maintenance</h2>
        {canManage && (
          <Button asChild>
            <Link href="/equipment/new"><Plus className="mr-2 h-4 w-4" />Add Item</Link>
          </Button>
        )}
      </div>
      <EquipmentStatCards overdue={overdue} dueSoon={dueSoon} active={items.filter((i) => i.status === "ACTIVE").length} />
      <EquipmentFilters />
      <EquipmentTable rows={rows} canManage={canManage} />
    </div>
  );
}
```

- [ ] **Step 5: Verify** — `npx tsc --noEmit` clean; load `/equipment` in the browser as a manager: stat cards, filters, and table render; "Add Item" shows for managers, hidden for HR. (Snooze button opens the dialog built in Task 7 — implement Task 7 before clicking it, or expect a missing-module error until then.)

> **Ordering note:** Task 7 (`snooze-dialog.tsx`) is imported by this table. If executing strictly in order, create a minimal stub of `snooze-dialog.tsx` first, or reorder Task 7 before Task 3. The stub: `export function SnoozeDialog() { return null; }`.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(auth\)/equipment/page.tsx src/components/equipment/equipment-stat-cards.tsx src/components/equipment/equipment-filters.tsx src/components/equipment/equipment-table.tsx
git commit -m "feat(maintenance-ui): items registry page with stats, filters, table"
```

---

## Task 4: Add/Edit item form

**Files:**
- Create: `src/components/equipment/equipment-form.tsx`
- Create: `src/app/(auth)/equipment/new/page.tsx`
- Create: `src/app/(auth)/equipment/[id]/edit/page.tsx`

- [ ] **Step 1: The form component** (client)

```tsx
// src/components/equipment/equipment-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_CATEGORIES, categoryLabel } from "@/lib/equipment-display";

export interface BranchOption { id: string; name: string; }
export interface EquipmentFormValues {
  id?: string;
  name?: string;
  category?: string;
  branchId?: string;
  location?: string | null;
  frequencyMonths?: number | null;
  reminderLeadDays?: number;
  notes?: string | null;
}

export function EquipmentForm({
  branches,
  defaultBranchId,
  initial,
}: {
  branches: BranchOption[];
  defaultBranchId?: string;
  initial?: EquipmentFormValues;
}) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EquipmentFormValues>({
    name: initial?.name ?? "",
    category: initial?.category ?? "OTHER",
    branchId: initial?.branchId ?? defaultBranchId ?? branches[0]?.id ?? "",
    location: initial?.location ?? "",
    frequencyMonths: initial?.frequencyMonths ?? null,
    reminderLeadDays: initial?.reminderLeadDays ?? 30,
    notes: initial?.notes ?? "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = isEdit ? `/api/equipment/${initial!.id}` : "/api/equipment";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          frequencyMonths: form.frequencyMonths || null,
          reminderLeadDays: Number(form.reminderLeadDays ?? 30),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save item");
      }
      toast.success(isEdit ? "Item updated" : "Item added");
      router.push("/equipment");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Item name</Label>
        <Input id="name" required value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Fire Extinguisher – Main Door" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ALL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Outlet</Label>
          <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })} disabled={!!defaultBranchId && branches.length === 1}>
            <SelectTrigger><SelectValue placeholder="Select outlet" /></SelectTrigger>
            <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="loc">Kitchen area / location</Label>
          <Input id="loc" value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Hot Kitchen" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="freq">Service every (months)</Label>
          <Input id="freq" type="number" min={1} value={form.frequencyMonths ?? ""} onChange={(e) => setForm({ ...form, frequencyMonths: e.target.value ? Number(e.target.value) : null })} placeholder="12" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead">Remind (days before)</Label>
          <Input id="lead" type="number" min={0} max={365} value={form.reminderLeadDays ?? 30} onChange={(e) => setForm({ ...form, reminderLeadDays: Number(e.target.value) })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : isEdit ? "Save changes" : "Add item"}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: New-item page** (server; supplies branch options scoped to role)

```tsx
// src/app/(auth)/equipment/new/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { EquipmentForm } from "@/components/equipment/equipment-form";

export default async function NewEquipmentPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const user = session.user as { role?: string; branchId?: string | null };
  if (!hasAccess(user.role ?? "", "equipment.manage")) redirect("/equipment");

  const branches =
    user.role === "BRANCH_MANAGER" && user.branchId
      ? await prisma.branch.findMany({ where: { id: user.branchId }, select: { id: true, name: true } })
      : await prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Add Item</h2>
      <div className="mx-auto max-w-2xl">
        <EquipmentForm branches={branches} defaultBranchId={user.role === "BRANCH_MANAGER" ? user.branchId ?? undefined : undefined} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Edit-item page** (server)

```tsx
// src/app/(auth)/equipment/[id]/edit/page.tsx
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { canManageBranch } from "@/lib/maintenance-access";
import { EquipmentForm } from "@/components/equipment/equipment-form";

export default async function EditEquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const user = session.user as { role?: string; branchId?: string | null };
  if (!hasAccess(user.role ?? "", "equipment.manage")) redirect("/equipment");
  const { id } = await params;

  const item = await prisma.equipment.findUnique({ where: { id } });
  if (!item) notFound();
  if (!canManageBranch(user.role ?? "", user.branchId ?? null, item.branchId)) redirect("/equipment");

  const branches = await prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Edit Item</h2>
      <div className="mx-auto max-w-2xl">
        <EquipmentForm
          branches={branches}
          initial={{
            id: item.id,
            name: item.name,
            category: item.category,
            branchId: item.branchId,
            location: item.location,
            frequencyMonths: item.frequencyMonths,
            reminderLeadDays: item.reminderLeadDays,
            notes: item.notes,
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean. As a manager, add an item via `/equipment/new`; confirm it appears in the list with a derived next-due date; edit it via `/equipment/[id]/edit`.

- [ ] **Step 5: Commit**

```bash
git add "src/components/equipment/equipment-form.tsx" "src/app/(auth)/equipment/new/page.tsx" "src/app/(auth)/equipment/[id]/edit/page.tsx"
git commit -m "feat(maintenance-ui): add/edit item form + pages"
```

---

## Task 5: Item detail + maintenance history

**Files:**
- Create: `src/components/equipment/maintenance-history.tsx`
- Create: `src/app/(auth)/equipment/[id]/page.tsx`

- [ ] **Step 1: History list component** (client)

```tsx
// src/components/equipment/maintenance-history.tsx
"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { maintenanceTypeLabel, formatINR } from "@/lib/equipment-display";

export interface HistoryRecord {
  id: string;
  serviceDate: string;
  maintenanceType: string;
  issue: string | null;
  vendorName: string | null;
  cost: number;
  status: string;
  remarks: string | null;
  billUrl: string | null;
  photoUrls: string[];
  loggedBy: { name: string | null } | null;
}

export function MaintenanceHistory({ records }: { records: HistoryRecord[] }) {
  if (records.length === 0) {
    return <p className="rounded-md border border-dashed p-6 text-center text-muted-foreground">No maintenance logged yet.</p>;
  }
  return (
    <div className="space-y-3">
      {records.map((r) => (
        <Card key={r.id}>
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{maintenanceTypeLabel(r.maintenanceType)}</Badge>
                <span className="text-sm text-muted-foreground">{format(new Date(r.serviceDate), "dd MMM yyyy")}</span>
                <Badge variant={r.status === "DONE" ? "default" : "secondary"}>{r.status}</Badge>
              </div>
              <span className="font-semibold">{formatINR(r.cost)}</span>
            </div>
            {r.issue && <p className="text-sm"><span className="text-muted-foreground">Issue:</span> {r.issue}</p>}
            {r.vendorName && <p className="text-sm"><span className="text-muted-foreground">Vendor:</span> {r.vendorName}</p>}
            {r.remarks && <p className="text-sm"><span className="text-muted-foreground">Remarks:</span> {r.remarks}</p>}
            <div className="flex flex-wrap items-center gap-3">
              {r.billUrl && <a href={r.billUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">View bill</a>}
              {r.photoUrls.map((u, i) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt={`Service photo ${i + 1}`} className="h-14 w-14 rounded object-cover" />
                </a>
              ))}
            </div>
            {r.loggedBy?.name && <p className="text-xs text-muted-foreground">Logged by {r.loggedBy.name}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Detail page** (server)

```tsx
// src/app/(auth)/equipment/[id]/page.tsx
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { categoryLabel, stateBadge } from "@/lib/equipment-display";
import { getReminderState } from "@/lib/services/maintenance-schedule";
import { MaintenanceHistory } from "@/components/equipment/maintenance-history";

export default async function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const user = session.user as { role?: string; branchId?: string | null };
  if (!hasAccess(user.role ?? "", "equipment.view")) redirect("/dashboard");
  const { id } = await params;

  const item = await prisma.equipment.findUnique({
    where: { id },
    include: {
      branch: { select: { id: true, name: true } },
      records: { orderBy: { serviceDate: "desc" }, include: { loggedBy: { select: { name: true } } } },
    },
  });
  if (!item) notFound();
  if (user.role === "BRANCH_MANAGER" && item.branchId !== (user.branchId ?? null)) redirect("/equipment");

  const canManage = hasAccess(user.role ?? "", "equipment.manage");
  const state = getReminderState(
    { nextDueDate: item.nextDueDate, reminderLeadDays: item.reminderLeadDays, snoozedUntil: item.snoozedUntil, status: item.status as "ACTIVE" | "RETIRED" },
    new Date()
  );
  const badge = stateBadge(state);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-3xl font-bold tracking-tight">{item.name}</h2>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="text-muted-foreground">
            {categoryLabel(item.category)} · {item.branch.name}{item.location ? ` · ${item.location}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {item.frequencyMonths ? `Every ${item.frequencyMonths} months` : "No fixed schedule"} ·
            {" "}Reminder {item.reminderLeadDays}d before ·
            {" "}Next due {item.nextDueDate ? format(item.nextDueDate, "dd MMM yyyy") : "—"}
            {item.snoozedUntil ? ` · Snoozed until ${format(item.snoozedUntil, "dd MMM yyyy")}` : ""}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button asChild><Link href={`/equipment/${item.id}/records/new`}>Log Maintenance</Link></Button>
            <Button asChild variant="outline"><Link href={`/equipment/${item.id}/edit`}>Edit</Link></Button>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold">Maintenance History</h3>
        <MaintenanceHistory
          records={item.records.map((r) => ({
            id: r.id,
            serviceDate: r.serviceDate.toISOString(),
            maintenanceType: r.maintenanceType,
            issue: r.issue,
            vendorName: r.vendorName,
            cost: Number(r.cost),
            status: r.status,
            remarks: r.remarks,
            billUrl: r.billUrl,
            photoUrls: r.photoUrls,
            loggedBy: r.loggedBy,
          }))}
        />
      </div>
    </div>
  );
}
```

> **Note:** `Number(r.cost)` converts the Prisma `Decimal` to a JS number for display — safe for the amounts involved here.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean. Open `/equipment/[id]`; header shows schedule + state badge; history is empty initially.

- [ ] **Step 4: Commit**

```bash
git add "src/components/equipment/maintenance-history.tsx" "src/app/(auth)/equipment/[id]/page.tsx"
git commit -m "feat(maintenance-ui): item detail page + maintenance history"
```

---

## Task 6: Log maintenance form (with uploads)

**Files:**
- Create: `src/lib/file-to-base64.ts`
- Create: `src/components/equipment/maintenance-record-form.tsx`
- Create: `src/app/(auth)/equipment/[id]/records/new/page.tsx`

- [ ] **Step 1: File→base64 helper** (+ unit test)

```typescript
// src/lib/file-to-base64.ts
export function fileToBase64(file: File): Promise<{ base64: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ base64: String(reader.result), contentType: file.type || "application/octet-stream" });
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
```

```typescript
// src/lib/__tests__/file-to-base64.test.ts
import { describe, it, expect } from "vitest";
import { fileToBase64 } from "@/lib/file-to-base64";

describe("fileToBase64", () => {
  it("reads a File into a data URL with its content type", async () => {
    const file = new File([Uint8Array.from([0x41])], "a.txt", { type: "text/plain" });
    const res = await fileToBase64(file);
    expect(res.contentType).toBe("text/plain");
    expect(res.base64.startsWith("data:")).toBe(true);
  });
});
```

Run: `npx vitest run src/lib/__tests__/file-to-base64.test.ts` → expected PASS. (Node 20 + vitest provide `File`/`FileReader`; if `FileReader` is unavailable in the node env, mark this test `it.skip` and rely on manual verification.)

- [ ] **Step 2: The log-maintenance form** (client)

```tsx
// src/components/equipment/maintenance-record-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MAINTENANCE_TYPES } from "@/lib/validations/equipment";
import { maintenanceTypeLabel } from "@/lib/equipment-display";
import { fileToBase64 } from "@/lib/file-to-base64";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function MaintenanceRecordForm({ equipmentId }: { equipmentId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    serviceDate: todayISO(),
    maintenanceType: "SERVICE",
    issue: "",
    vendorName: "",
    vendorContact: "",
    cost: "0",
    status: "DONE",
    remarks: "",
    nextDueDate: "",
  });
  const [bill, setBill] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const billPayload = bill ? await fileToBase64(bill) : null;
      const photoPayload = await Promise.all(photos.map((p) => fileToBase64(p)));
      const res = await fetch(`/api/equipment/${equipmentId}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cost: Number(form.cost || 0),
          nextDueDate: form.nextDueDate || null,
          bill: billPayload,
          photos: photoPayload,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to log maintenance");
      }
      toast.success("Maintenance logged");
      router.push(`/equipment/${equipmentId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log maintenance");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date">Service date</Label>
          <Input id="date" type="date" required value={form.serviceDate} onChange={(e) => setForm({ ...form, serviceDate: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Maintenance type</Label>
          <Select value={form.maintenanceType} onValueChange={(v) => setForm({ ...form, maintenanceType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MAINTENANCE_TYPES.map((t) => <SelectItem key={t} value={t}>{maintenanceTypeLabel(t)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="issue">Issue / observation</Label>
        <Textarea id="issue" value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="vendor">Vendor / technician</Label>
          <Input id="vendor" value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vc">Vendor contact</Label>
          <Input id="vc" value={form.vendorContact} onChange={(e) => setForm({ ...form, vendorContact: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="cost">Cost (₹)</Label>
          <Input id="cost" type="number" min={0} step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DONE">Done</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="next">Next due date (optional)</Label>
          <Input id="next" type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="bill">Bill / invoice (PDF or image)</Label>
        <Input id="bill" type="file" accept="application/pdf,image/*" onChange={(e) => setBill(e.target.files?.[0] ?? null)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="photos">Service photos</Label>
        <Input id="photos" type="file" accept="image/*" multiple onChange={(e) => setPhotos(Array.from(e.target.files ?? []))} />
        {photos.length > 0 && <p className="text-xs text-muted-foreground">{photos.length} photo(s) selected</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="remarks">Remarks</Label>
        <Textarea id="remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Log maintenance"}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: The log-maintenance page** (server; authorizes branch)

```tsx
// src/app/(auth)/equipment/[id]/records/new/page.tsx
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { canManageBranch } from "@/lib/maintenance-access";
import { MaintenanceRecordForm } from "@/components/equipment/maintenance-record-form";

export default async function LogMaintenancePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const user = session.user as { role?: string; branchId?: string | null };
  if (!hasAccess(user.role ?? "", "equipment.records.create")) redirect("/equipment");
  const { id } = await params;

  const item = await prisma.equipment.findUnique({ where: { id }, select: { id: true, name: true, branchId: true } });
  if (!item) notFound();
  if (!canManageBranch(user.role ?? "", user.branchId ?? null, item.branchId)) redirect("/equipment");

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Log Maintenance — {item.name}</h2>
      <div className="mx-auto max-w-2xl">
        <MaintenanceRecordForm equipmentId={item.id} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify end-to-end** — start dev server. As a manager, open an item → "Log Maintenance" → fill type/cost/vendor, attach a small image + a PDF bill → submit. Confirm: redirect to detail, the record appears in history with bill link + photo thumbnail, and the item's "Next due" advanced (when frequency is set). Check `preview_network` shows `POST /api/equipment/[id]/records` → 201.

- [ ] **Step 5: Commit**

```bash
git add src/lib/file-to-base64.ts src/lib/__tests__/file-to-base64.test.ts "src/components/equipment/maintenance-record-form.tsx" "src/app/(auth)/equipment/[id]/records/new/page.tsx"
git commit -m "feat(maintenance-ui): log-maintenance form with bill/photo upload"
```

---

## Task 7: Snooze dialog

**Files:**
- Create: `src/components/equipment/snooze-dialog.tsx`

> If you created a stub during Task 3, replace it now.

- [ ] **Step 1: Write the component**

```tsx
// src/components/equipment/snooze-dialog.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDays } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function iso(d: Date) { return d.toISOString().slice(0, 10); }

export function SnoozeDialog({
  equipmentId,
  open,
  onOpenChange,
}: {
  equipmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(iso(addDays(new Date(), 7)));
  const [saving, setSaving] = useState(false);

  async function snooze(until: string | null) {
    setSaving(true);
    try {
      const res = await fetch(`/api/equipment/${equipmentId}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snoozedUntil: until }),
      });
      if (!res.ok) throw new Error("Failed to snooze");
      toast.success(until ? "Reminder snoozed" : "Snooze cleared");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to snooze");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Snooze reminder</DialogTitle>
          <DialogDescription>Pause the daily reminder email for this item until the chosen date.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={saving} onClick={() => snooze(iso(addDays(new Date(), 7)))}>+7 days</Button>
          <Button variant="secondary" disabled={saving} onClick={() => snooze(iso(addDays(new Date(), 14)))}>+14 days</Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="snooze-date">Or pick a date</Label>
          <Input id="snooze-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" disabled={saving} onClick={() => snooze(null)}>Clear snooze</Button>
          <Button disabled={saving} onClick={() => snooze(date)}>Snooze until {date}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean. On the items list, click "Snooze" on a due item; pick +7 days; confirm the item's badge becomes "Snoozed" after refresh and it drops out of the next reminder digest (re-run the cron route and confirm the item is excluded).

- [ ] **Step 3: Commit**

```bash
git add "src/components/equipment/snooze-dialog.tsx"
git commit -m "feat(maintenance-ui): snooze dialog"
```

---

## Task 8: Cost summary page

**Files:**
- Create: `src/app/(auth)/equipment/costs/page.tsx`

- [ ] **Step 1: Write the page** (server; groups spend by category + lists by item, branch-scoped, optional date range via search params)

```tsx
// src/app/(auth)/equipment/costs/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { equipmentWhereForRole } from "@/lib/maintenance-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { categoryLabel, formatINR } from "@/lib/equipment-display";

export default async function CostSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const user = session.user as { role?: string; branchId?: string | null };
  if (!hasAccess(user.role ?? "", "equipment.view")) redirect("/dashboard");

  const sp = await searchParams;
  const scope = equipmentWhereForRole(user.role ?? "", user.branchId ?? null);
  const branchId = (scope as { branchId?: string }).branchId;

  const dateFilter =
    sp.from || sp.to
      ? { serviceDate: { ...(sp.from ? { gte: new Date(sp.from) } : {}), ...(sp.to ? { lte: new Date(sp.to) } : {}) } }
      : {};
  const recordWhere = { ...(branchId ? { branchId } : {}), ...dateFilter };

  const records = await prisma.maintenanceRecord.findMany({
    where: recordWhere,
    select: { cost: true, equipment: { select: { name: true, category: true, branch: { select: { name: true } } } } },
  });

  const total = records.reduce((sum, r) => sum + Number(r.cost), 0);
  const byCategory = new Map<string, number>();
  for (const r of records) {
    const c = r.equipment.category;
    byCategory.set(c, (byCategory.get(c) ?? 0) + Number(r.cost));
  }
  const categoryRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Maintenance Cost Summary</h2>
      <Card>
        <CardHeader><CardTitle>Total spend</CardTitle></CardHeader>
        <CardContent><p className="text-3xl font-bold">{formatINR(total)}</p>
          <p className="text-sm text-muted-foreground">{records.length} maintenance record(s)</p>
        </CardContent>
      </Card>
      <div>
        <h3 className="mb-3 text-lg font-semibold">By category</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Spend</TableHead></TableRow></TableHeader>
            <TableBody>
              {categoryRows.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No spend in this range.</TableCell></TableRow>
              ) : (
                categoryRows.map(([cat, amt]) => (
                  <TableRow key={cat}><TableCell>{categoryLabel(cat)}</TableCell><TableCell className="text-right">{formatINR(amt)}</TableCell></TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean. Open `/equipment/costs`; after logging a record with a cost, total + category breakdown reflect it; a manager sees only their outlet's spend.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/equipment/costs/page.tsx"
git commit -m "feat(maintenance-ui): cost summary page (total + by category, branch-scoped)"
```

---

## Task 9: Dashboard due-soon widget

**Files:**
- Create: `src/components/dashboard/maintenance-due-widget.tsx`
- Modify: the dashboard page (find it: `src/app/(auth)/dashboard/page.tsx`) — render the widget for users with `equipment.view`.

- [ ] **Step 1: Locate the dashboard** — Run: `find src/app -path '*dashboard*' -name 'page.tsx'` and open it to see where role-specific cards are composed.

- [ ] **Step 2: Write the widget** (server component — async, does its own scoped query)

```tsx
// src/components/dashboard/maintenance-due-widget.tsx
import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { equipmentWhereForRole } from "@/lib/maintenance-access";
import { getReminderState, daysUntil } from "@/lib/services/maintenance-schedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { stateBadge } from "@/lib/equipment-display";

export async function MaintenanceDueWidget({ role, branchId }: { role: string; branchId: string | null }) {
  const items = await prisma.equipment.findMany({
    where: { ...equipmentWhereForRole(role, branchId), status: "ACTIVE", nextDueDate: { not: null } },
    include: { branch: { select: { name: true } } },
    orderBy: { nextDueDate: "asc" },
  });

  const today = new Date();
  const due = items
    .map((it) => ({
      it,
      state: getReminderState(
        { nextDueDate: it.nextDueDate, reminderLeadDays: it.reminderLeadDays, snoozedUntil: it.snoozedUntil, status: it.status as "ACTIVE" | "RETIRED" },
        today
      ),
    }))
    .filter((x) => x.state === "OVERDUE" || x.state === "DUE_SOON")
    .slice(0, 6);

  if (due.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Maintenance due</CardTitle>
        <Button asChild size="sm" variant="ghost"><Link href="/equipment">View all</Link></Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {due.map(({ it, state }) => {
          const badge = stateBadge(state);
          return (
            <div key={it.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
              <div className="min-w-0">
                <Link href={`/equipment/${it.id}`} className="truncate font-medium hover:underline">{it.name}</Link>
                <p className="text-xs text-muted-foreground">
                  {it.branch.name} · due {it.nextDueDate ? format(it.nextDueDate, "dd MMM") : "—"}
                  {it.nextDueDate ? ` (${daysUntil(it.nextDueDate, today)}d)` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={badge.variant}>{badge.label}</Badge>
                <Button asChild size="sm" variant="secondary"><Link href={`/equipment/${it.id}/records/new`}>Log</Link></Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Render it on the dashboard** — in `src/app/(auth)/dashboard/page.tsx`, where the session role/branch are available, add (guarded by access):

```tsx
import { hasAccess } from "@/lib/access-control";
import { MaintenanceDueWidget } from "@/components/dashboard/maintenance-due-widget";
// ...inside the JSX, in the cards/grid area:
{hasAccess(role, "equipment.view") && (
  // @ts-expect-error Async Server Component
  <MaintenanceDueWidget role={role} branchId={branchId ?? null} />
)}
```

> Match the local variable names used in that dashboard file for `role` and `branchId`; they are read from `session.user` there. The `@ts-expect-error` line is only needed if the file is not already rendering async server components.

- [ ] **Step 4: Verify** — load `/dashboard` as a manager with an overdue/due-soon item: the widget appears with the item, state badge, and a "Log" shortcut; it is absent when nothing is due.

- [ ] **Step 5: Commit**

```bash
git add "src/components/dashboard/maintenance-due-widget.tsx" "src/app/(auth)/dashboard/page.tsx"
git commit -m "feat(maintenance-ui): dashboard maintenance-due widget"
```

---

## Task 10: Final verification

- [ ] **Step 1: Type + lint + unit tests**

Run: `npx tsc --noEmit && npm run lint && npx vitest run src/lib`
Expected: no type errors, lint clean, all pure-helper suites green.

- [ ] **Step 2: Manual smoke test (preview workflow)** — as **BRANCH_MANAGER**: add item → it shows due/scheduled; log maintenance with bill+photos → history + next-due update; snooze → badge changes; dashboard widget shows due items; cost summary reflects spend. As **HR**: `/equipment` is read-only (no "Add Item"/"Log"/"Snooze"). As **EMPLOYEE**: no "Maintenance" nav, `/equipment` redirects to dashboard.

- [ ] **Step 3: Restart dev server** after any build so the running instance reflects the merged UI (per project convention).

- [ ] **Step 4: Final commit (if anything outstanding)**

```bash
git add -A && git commit -m "chore(maintenance-ui): final verification pass" || echo "nothing to commit"
```

---

## Done criteria (frontend)

- "Maintenance" appears in the sidebar for manager/HR/management; hidden for employees.
- Managers can add/edit items, log maintenance (with bill + photos to Azure), and snooze — scoped to their outlet; management can do so for all outlets; HR is read-only.
- Item detail shows schedule + state badge + full history with bill/photo links.
- Cost summary shows total + per-category spend, branch-scoped and date-filterable.
- The dashboard widget surfaces overdue/due-soon items with a one-click "Log" shortcut.
