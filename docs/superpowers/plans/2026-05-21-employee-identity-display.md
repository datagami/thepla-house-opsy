# Employee Identity Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize every UI surface that shows an employee's name to also show their `#numId` and image (with initials fallback) via one shared `<EmployeeIdentity />` component.

**Architecture:** Build one shadcn-style component in `src/components/ui/employee-identity.tsx` with `sm`/`md`/`lg` size variants. Extract two pure helpers (`stringToHue`, `getInitials`) into `src/lib/utils.ts` with unit tests. Introduce a `userIdentitySelect` Prisma preset; spread it into every list/detail fetch. Then mechanically replace `{user.name}` call sites domain-by-domain.

**Tech Stack:** Next.js 14 App Router · Prisma · shadcn/ui (Radix Avatar) · Tailwind · Vitest (node env). Branch: `feature/employee-identity-display` (already created).

**Testability note:** The repo's Vitest config uses `environment: 'node'` with no `@testing-library/react`. We test pure helpers (TDD). Component verification is manual via `npm run dev` + smoke pass per task. Type errors at call sites act as the safety net for the data-plumbing tasks.

**Spec:** `docs/superpowers/specs/2026-05-21-employee-identity-display-design.md`

---

## Phase 1 — Foundation

### Task 1: Extract `stringToHue` into `src/lib/utils.ts`

**Files:**
- Modify: `src/lib/utils.ts` (add export)
- Modify: `src/components/leave/leave-request-table.tsx` (remove local copy, import from utils)
- Create: `src/lib/__tests__/string-to-hue.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/string-to-hue.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { stringToHue } from '@/lib/utils';

describe('stringToHue', () => {
  it('returns a number in [0, 359]', () => {
    const h = stringToHue('Rohit Kumar');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  });

  it('is deterministic for the same input', () => {
    expect(stringToHue('Anya Sharma')).toBe(stringToHue('Anya Sharma'));
  });

  it('produces different hues for different inputs', () => {
    expect(stringToHue('Rohit')).not.toBe(stringToHue('Anya'));
  });

  it('handles the empty string', () => {
    expect(stringToHue('')).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/string-to-hue.test.ts`
Expected: FAIL with `"stringToHue" is not exported by "src/lib/utils.ts"`.

- [ ] **Step 3: Add the helper to `src/lib/utils.ts`**

Append to `src/lib/utils.ts`:

```ts
/**
 * Hash a string into a hue value [0, 360). Used to give each person/department
 * a stable color (e.g. for avatar fallback backgrounds, department pills).
 */
export function stringToHue(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/string-to-hue.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Remove the duplicate from `leave-request-table.tsx`**

In `src/components/leave/leave-request-table.tsx`:
- Delete the local `function stringToHue(input: string) { ... }` block (currently around lines 74–82).
- Add an import at the top: `import { stringToHue } from "@/lib/utils";` (merge into the existing utils import if one already exists).

- [ ] **Step 6: Typecheck + full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors. All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/utils.ts src/lib/__tests__/string-to-hue.test.ts src/components/leave/leave-request-table.tsx
git commit -m "refactor(utils): promote stringToHue to shared util"
```

---

### Task 2: Add `getInitials` helper

**Files:**
- Modify: `src/lib/utils.ts`
- Create: `src/lib/__tests__/get-initials.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/get-initials.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getInitials } from '@/lib/utils';

describe('getInitials', () => {
  it('uses first letters of first and last whitespace-separated tokens', () => {
    expect(getInitials('Rohit Kumar')).toBe('RK');
  });

  it('returns a single uppercase letter for one-word names', () => {
    expect(getInitials('Rohit')).toBe('R');
  });

  it('ignores middle tokens', () => {
    expect(getInitials('Rohit Kumar Singh')).toBe('RS');
  });

  it('collapses extra whitespace', () => {
    expect(getInitials('  Rohit   Kumar  ')).toBe('RK');
  });

  it('returns "?" for null/undefined/empty input', () => {
    expect(getInitials(null)).toBe('?');
    expect(getInitials(undefined)).toBe('?');
    expect(getInitials('')).toBe('?');
    expect(getInitials('   ')).toBe('?');
  });

  it('uppercases lowercase input', () => {
    expect(getInitials('rohit kumar')).toBe('RK');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/get-initials.test.ts`
Expected: FAIL — `getInitials` not exported.

- [ ] **Step 3: Implement in `src/lib/utils.ts`**

Append to `src/lib/utils.ts`:

```ts
/**
 * Extract up to two initials from a person's name:
 * first letter of first token + first letter of last token, uppercased.
 * Returns "?" for null/empty input.
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '?';
  if (tokens.length === 1) return tokens[0].charAt(0).toUpperCase();
  const first = tokens[0].charAt(0);
  const last = tokens[tokens.length - 1].charAt(0);
  return (first + last).toUpperCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/get-initials.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils.ts src/lib/__tests__/get-initials.test.ts
git commit -m "feat(utils): add getInitials helper for avatar fallback"
```

---

### Task 3: Add `userIdentitySelect` Prisma preset and `EmployeeIdentityUser` type

**Files:**
- Create: `src/lib/select-presets.ts`
- Modify: `src/models/models.ts` (export the type)

- [ ] **Step 1: Create the preset**

Create `src/lib/select-presets.ts`:

```ts
/**
 * Prisma `select` presets for stable cross-cutting projections.
 * Spread these into a `.select` block so every consumer gets the same shape.
 */

export const userIdentitySelect = {
  id: true,
  name: true,
  numId: true,
  image: true,
} as const;
```

- [ ] **Step 2: Add the type to `src/models/models.ts`**

Open `src/models/models.ts`. After the existing `User` type/interface definition, append:

```ts
export type EmployeeIdentityUser = {
  id: string;
  name: string | null;
  numId: number | null;
  image: string | null;
};
```

(Defined structurally rather than as `Pick<User, ...>` so the type is usable even where the full `User` shape isn't imported.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/select-presets.ts src/models/models.ts
git commit -m "feat(types): add EmployeeIdentityUser + userIdentitySelect preset"
```

---

### Task 4: Build the `EmployeeIdentity` component

**Files:**
- Create: `src/components/ui/employee-identity.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ui/employee-identity.tsx`:

```tsx
import * as React from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, getInitials, stringToHue } from "@/lib/utils";
import type { EmployeeIdentityUser } from "@/models/models";

type Size = "sm" | "md" | "lg";

interface EmployeeIdentityProps {
  user: EmployeeIdentityUser;
  size?: Size;
  subtitle?: React.ReactNode;
  href?: string;
  className?: string;
}

const AVATAR_SIZE: Record<Size, string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-12 w-12 text-base",
};

const NAME_TEXT: Record<Size, string> = {
  sm: "text-sm font-medium leading-tight",
  md: "text-sm font-medium leading-tight",
  lg: "text-base font-semibold leading-tight",
};

const ID_TEXT: Record<Size, string> = {
  sm: "text-xs text-muted-foreground",
  md: "text-xs text-muted-foreground leading-tight",
  lg: "text-sm text-muted-foreground leading-tight",
};

export function EmployeeIdentity({
  user,
  size = "md",
  subtitle,
  href,
  className,
}: EmployeeIdentityProps) {
  const initials = getInitials(user.name);
  const hue = user.name ? stringToHue(user.name) : null;
  const fallbackStyle = hue !== null
    ? { backgroundColor: `hsl(${hue} 60% 50%)`, color: "white" }
    : { backgroundColor: "hsl(0 0% 80%)", color: "white" };

  const idLine = subtitle ?? (user.numId !== null ? `#${user.numId}` : null);

  const inner = (
    <div
      className={cn(
        "inline-flex items-center gap-2 min-w-0",
        className,
      )}
    >
      <Avatar className={cn(AVATAR_SIZE[size], "shrink-0")}>
        {user.image ? (
          <AvatarImage
            src={user.image}
            alt={user.name ?? "Employee"}
            loading="lazy"
          />
        ) : null}
        <AvatarFallback style={fallbackStyle}>{initials}</AvatarFallback>
      </Avatar>

      {size === "sm" ? (
        <div className="min-w-0 truncate">
          <span className={NAME_TEXT[size]}>{user.name ?? "Unnamed"}</span>
          {idLine !== null && (
            <span className={cn("ml-1.5", ID_TEXT[size])}>· {idLine}</span>
          )}
        </div>
      ) : (
        <div className="min-w-0">
          <div className={cn(NAME_TEXT[size], "truncate")}>
            {user.name ?? "Unnamed"}
          </div>
          {idLine !== null && (
            <div className={cn(ID_TEXT[size], "truncate")}>{idLine}</div>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="hover:underline">
        {inner}
      </Link>
    );
  }
  return inner;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Smoke-render the component**

Start the dev server: `npm run dev`. In a browser, open any existing page that shows a user (e.g. `/users`). Temporarily, in `src/app/(auth)/users/page.tsx`, drop a one-line preview at the top of the rendered output:

```tsx
<EmployeeIdentity user={{ id: "x", name: "Test Person", numId: 99, image: null }} size="md" />
```

Verify the avatar shows `TP` on a colored background and `#99` below the name. Then revert the preview line. Do not commit the preview.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/employee-identity.tsx
git commit -m "feat(ui): add EmployeeIdentity component with sm/md/lg variants"
```

---

## Phase 2 — Migrate call sites domain by domain

For every Phase-2 task, the pattern is identical:
1. Update the server-side fetch(es) to spread `userIdentitySelect` into the user `select` block.
2. Replace `{user.name}` (or equivalent) in the matching client component with `<EmployeeIdentity user={user} size="md" />` (or `"sm"` / `"lg"` per surface).
3. Remove now-redundant inline `#numId` displays.
4. Typecheck + dev-server smoke pass.
5. Commit.

### Task 5: Migrate Attendance domain

**Files:**
- Modify (server): `src/app/(auth)/attendance/page.tsx`, `src/app/(auth)/attendance/[userId]/page.tsx`, `src/app/(auth)/attendance/self/page.tsx`, `src/app/(auth)/hr/branch-attendance/page.tsx`, `src/app/(auth)/hr/manage-attendance/page.tsx`, `src/app/(auth)/hr/pending-attendance/page.tsx`, `src/app/(auth)/hr/attendance-verification/page.tsx`, `src/app/(auth)/hr/attendance-conflicts/page.tsx`
- Modify (client): `src/components/attendance/attendance-table.tsx`, `src/components/attendance/branch-attendance-submissions.tsx`, `src/components/attendance/attendance-verification-table.tsx`, `src/components/attendance/shared-attendance-table.tsx`, `src/components/attendance/daily-attendance-view.tsx`, `src/components/reports/attendance-reports.tsx`

- [ ] **Step 1: Add the preset to every attendance user `select`**

In each server page listed above, locate the `prisma.user.findMany({ select: { ... } })` (or `.user.findUnique`) and spread `userIdentitySelect` into it. Example for `src/app/(auth)/attendance/page.tsx`:

```tsx
import { userIdentitySelect } from "@/lib/select-presets";

// ...
const users = await prisma.user.findMany({
  where: { /* unchanged */ },
  select: {
    ...userIdentitySelect,
    department: { select: { id: true, name: true } },
    attendance: { /* unchanged */ },
  },
  orderBy: { name: "asc" },
});
```

Repeat for each file in the list. The `id` and `name` fields previously selected by hand can be removed since the preset provides them.

- [ ] **Step 2: Replace the name cell in `attendance-table.tsx`**

In `src/components/attendance/attendance-table.tsx`, locate the `<TableCell>{user.name}</TableCell>` (currently line 71) and replace with:

```tsx
<TableCell>
  <EmployeeIdentity user={user} size="md" />
</TableCell>
```

Add the import:
```tsx
import { EmployeeIdentity } from "@/components/ui/employee-identity";
```

- [ ] **Step 3: Replace name displays in the remaining attendance client files**

For each of `branch-attendance-submissions.tsx`, `attendance-verification-table.tsx`, `shared-attendance-table.tsx`, `attendance-reports.tsx`: find the `{user.name}` (or `{employee.name}`) usages in row cells and dialog headers and replace with `<EmployeeIdentity user={user} size="md" />`. For compact dropdowns or chips inside these files, use `size="sm"`.

`daily-attendance-view.tsx` does not directly render names — it delegates to `attendance-table.tsx`. No change needed there except confirming nothing breaks at the type boundary.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors. Any errors usually mean a server fetch is missing `userIdentitySelect`; fix at the source rather than narrowing the prop at the call site.

- [ ] **Step 5: Smoke pass**

Run: `npm run dev`. Visit `/attendance`, `/hr/branch-attendance`, `/hr/manage-attendance`, `/hr/pending-attendance`, `/hr/attendance-verification`, `/hr/attendance-conflicts`. Confirm every row shows avatar + name + `#ID`. Click a row to confirm the edit modal still opens. Verify search/filter still works.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(auth\)/attendance src/app/\(auth\)/hr src/components/attendance src/components/reports/attendance-reports.tsx
git commit -m "feat(attendance): show #numId + avatar everywhere via EmployeeIdentity"
```

---

### Task 6: Migrate Salary domain

**Files:**
- Modify (server): `src/app/api/salary/route.ts`, `src/app/api/salary/[id]/route.ts`, `src/app/api/salary/[id]/stats/route.ts`, `src/app/api/salary/generate-enet/route.ts`, `src/app/api/salary/generate-report/route.ts`
- Modify (client): `src/components/salary/salary-list.tsx`, `src/components/salary/salary-stats-table.tsx`, `src/components/salary/salary-details.tsx`, `src/components/salary/salary-management.tsx`

- [ ] **Step 1: Add `userIdentitySelect` to every salary server fetch**

In each API route, find the `user: { select: { ... } }` block inside the salary query and spread `userIdentitySelect`. Example for `src/app/api/salary/route.ts`:

```ts
import { userIdentitySelect } from "@/lib/select-presets";
// ...
const salaries = await prisma.salary.findMany({
  // ...
  select: {
    /* existing salary fields */
    user: { select: { ...userIdentitySelect /* + any extra fields already selected */ } },
  },
});
```

The PDF/CSV export endpoints (`generate-enet`, `generate-report`) are out of scope per the spec, but if their `select` already includes the user fields, leave them; do not change the export output.

- [ ] **Step 2: Replace name cells in `salary-list.tsx`**

In `src/components/salary/salary-list.tsx`:
- Replace the `{salary.user?.name}` (and the inline `Emp #{numId}` rendering around line 532) with `<EmployeeIdentity user={salary.user} size="md" />`.
- Keep the existing search input working with `numId.toString().includes(search)` (already present).

- [ ] **Step 3: Replace name displays in remaining salary client files**

`salary-stats-table.tsx`, `salary-details.tsx`, `salary-management.tsx`: replace each `{user.name}` row/header rendering with `<EmployeeIdentity user={user} size="md" />` (use `"lg"` for the salary detail page top header).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Smoke pass**

Run: `npm run dev`. Visit `/salary`, `/salary/[someId]`. Confirm rows show avatar + name + `#ID`. Confirm salary detail page header shows the `lg` variant.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/salary src/components/salary
git commit -m "feat(salary): show #numId + avatar everywhere via EmployeeIdentity"
```

---

### Task 7: Migrate Advances domain

**Files:**
- Modify (server): `src/app/api/advances/route.ts`, `src/app/api/advances/discrepancies/route.ts`
- Modify (client): `src/components/advances/advance-row.tsx`, `src/components/advances/advance-payments-list.tsx`, `src/components/advances/advance-discrepancies.tsx`

(Skip `src/app/api/advances/export/route.ts` — exports are out of scope.)

- [ ] **Step 1: Add `userIdentitySelect` to advance fetches**

For each server route, spread `userIdentitySelect` into the user-related `select` block. The `numId` field is already present; spreading the preset makes it the same shape as elsewhere and adds `image`.

- [ ] **Step 2: Replace inline `#numId` in `advance-row.tsx`**

In `src/components/advances/advance-row.tsx`:
- Locate the block around line 107 that renders `<div className="font-semibold">#{advance.numId}</div>` together with the user name.
- Replace the entire two-element `name + #numId` group with `<EmployeeIdentity user={advance.user} size="md" />` (the user object inside the advance row already includes `numId`).
- Delete now-unused style classes.

- [ ] **Step 3: Migrate `advance-payments-list.tsx` and `advance-discrepancies.tsx`**

Replace `{user.name}` renderings with `<EmployeeIdentity user={user} size="md" />`. Where the layout used a stacked custom `Emp #...` block, remove it.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Smoke pass**

Visit `/advances` (and the discrepancies sub-page). Confirm rows show the new identity block and no leftover duplicate `#numId` text.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/advances src/components/advances
git commit -m "feat(advances): unify #numId display via EmployeeIdentity"
```

---

### Task 8: Migrate Users / Employees domain

**Files:**
- Modify (server): `src/app/api/users/route.ts`, `src/app/api/users/[id]/route.ts`, `src/app/(auth)/users/[id]/page.tsx`, `src/app/(auth)/users/[id]/joining-form-signature/page.tsx`, `src/app/(auth)/users/[id]/warnings/page.tsx`
- Modify (client): `src/components/users/user-table.tsx`, `src/components/users/user-actions.tsx`, `src/components/users/user-data-import-export.tsx`, `src/components/users/user-profile-form.tsx`, `src/components/users/joining-form-esignature.tsx`, `src/components/employees/employee-table.tsx`, `src/components/dashboard/pending-signatures-widget.tsx`

- [ ] **Step 1: Add `userIdentitySelect` to user listing/detail fetches**

`src/app/api/users/route.ts` and `[id]/route.ts`: spread `userIdentitySelect` into the response `select`. Where the API already returns the full user object via Prisma's default behavior, switch to an explicit `select` that uses the preset plus the extra fields the endpoint actually needs (`email`, `role`, `status`, `branch`, etc.).

For the `(auth)/users/[id]` server pages, do the same.

- [ ] **Step 2: Replace name cells in `user-table.tsx` and `employee-table.tsx`**

For each table row that renders `{user.name}` or `{employee.name}`, swap in `<EmployeeIdentity user={user} size="md" href={\`/users/\${user.id}\`} />` (use the `href` prop to keep the row link behavior). If the row already wraps in a `<Link>`, drop the link wrap to avoid nested anchors; the component handles linking.

- [ ] **Step 3: Replace name displays in user-detail / form headers**

`user-profile-form.tsx`, `joining-form-esignature.tsx`, `(auth)/users/[id]/page.tsx`: at the top-of-page header, render `<EmployeeIdentity user={user} size="lg" />`. Inline references within the form body (e.g. confirmation dialog text) stay as plain `user.name` — those are sentence-fragments, not identity displays.

- [ ] **Step 4: Migrate `pending-signatures-widget.tsx`**

In the dashboard pending-signatures list, replace each row's `{user.name}` with `<EmployeeIdentity user={user} size="sm" />`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Smoke pass**

Run: `npm run dev`. Visit `/users`, click into a user detail page, visit `/dashboard` (pending signatures widget), visit `/users/[id]/joining-form-signature`. Confirm each surface shows avatar + name + `#ID`.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/users src/app/\(auth\)/users src/components/users src/components/employees src/components/dashboard/pending-signatures-widget.tsx
git commit -m "feat(users): show #numId + avatar across user/employee surfaces"
```

---

### Task 9: Migrate Leave domain

**Files:**
- Modify (server): `src/app/api/leave-requests/route.ts`
- Modify (client): `src/components/leave/leave-request-table.tsx`

(Skip `src/app/api/leave-requests/export/route.ts` and `src/app/api/reports/leave/route.ts` — exports out of scope.)

- [ ] **Step 1: Add `userIdentitySelect` to leave-request fetch**

In `src/app/api/leave-requests/route.ts`, spread `userIdentitySelect` into the `user: { select: {...} }` block.

- [ ] **Step 2: Replace name cell in `leave-request-table.tsx`**

Replace the row's user-name rendering with `<EmployeeIdentity user={request.user} size="md" />`. Keep the existing `DepartmentPill` in its own column.

- [ ] **Step 3: Typecheck + smoke**

Run: `npx tsc --noEmit && npm run dev`. Visit `/leave-requests`. Confirm rows show identity block plus department pill (unchanged) plus status badge (unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/leave-requests src/components/leave/leave-request-table.tsx
git commit -m "feat(leave): show #numId + avatar in leave request table"
```

---

### Task 10: Migrate Warnings domain

**Files:**
- Modify (server): `src/app/api/warnings/route.ts` (and any sibling routes that return user data)
- Modify (client): `src/components/warnings/warnings-management-page.tsx`

- [ ] **Step 1: Add `userIdentitySelect` to warnings server fetches**

In every API route under `src/app/api/warnings/` that returns user data (the warned user, the reporter, the archiver), spread `userIdentitySelect`. Use `grep -rn "select" src/app/api/warnings/` to enumerate them.

- [ ] **Step 2: Replace name cells in `warnings-management-page.tsx`**

For each `{user.name}` in row cells and dialog headers, swap in `<EmployeeIdentity user={user} size="md" />` (use `"sm"` for inline references to reporter/archiver in the row footer if any).

- [ ] **Step 3: Typecheck + smoke**

Run: `npx tsc --noEmit && npm run dev`. Visit `/warnings`. Confirm each warning row shows the warned user's identity block.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/warnings src/components/warnings
git commit -m "feat(warnings): show #numId + avatar in warnings management"
```

---

### Task 11: Migrate Notes domain

**Files:**
- Modify (server): `src/app/api/notes/route.ts`, `src/app/api/notes/[id]/route.ts`, plus any other route under `src/app/api/notes/` that returns user data (`/share`, `/comments`, `/history`).
- Modify (client): `src/components/notes/NoteDetail.tsx` (and any siblings under `src/components/notes/` that render names)

- [ ] **Step 1: Add `userIdentitySelect` to notes server fetches**

For each note-related route, spread `userIdentitySelect` into the user, share-target, comment-author, and edit-history-editor sub-selects.

- [ ] **Step 2: Replace name displays in `NoteDetail.tsx`**

Identify each name display:
- Note owner header → `<EmployeeIdentity user={note.owner} size="md" />`
- Shared-with list → `<EmployeeIdentity user={share.user} size="sm" />` per row
- Comment author → `<EmployeeIdentity user={comment.author} size="sm" />`
- Edit history editor → `<EmployeeIdentity user={edit.editor} size="sm" />`

- [ ] **Step 3: Typecheck + smoke**

Run: `npx tsc --noEmit && npm run dev`. Open any note. Confirm owner header, share list, comments, and edit history all show the identity block.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/notes src/components/notes
git commit -m "feat(notes): show #numId + avatar for owner, shares, comments, history"
```

---

### Task 12: Migrate Referrals domain

**Files:**
- Modify (server): `src/app/api/referrals/route.ts` (and any sibling routes that return user data; skip `/export/route.ts`)
- Modify (client): any component under `src/components/referrals/` that renders a user name (use `grep -rn "user.name\|referrer\.name\|referred\.name" src/components/referrals` to enumerate)

- [ ] **Step 1: Add `userIdentitySelect` to referrals server fetches**

Spread the preset into both the `referrer` and `referred` user sub-selects.

- [ ] **Step 2: Replace name displays in referrals components**

For each row/card, swap referrer and referred name displays for `<EmployeeIdentity user={...} size="md" />`.

- [ ] **Step 3: Typecheck + smoke**

Run: `npx tsc --noEmit && npm run dev`. Visit the referrals page. Confirm both sides of each referral show the identity block.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/referrals src/components/referrals
git commit -m "feat(referrals): show #numId + avatar for referrer and referred"
```

---

### Task 13: Migrate Activity Logs

**Files:**
- Modify (server): the API route(s) under `src/app/api/activity-logs/` (use `grep -rln "activity-logs" src/app/api`)
- Modify (client): `src/components/activity-logs/activity-logs-view.tsx`

- [ ] **Step 1: Add `userIdentitySelect` to activity-log fetches**

Spread `userIdentitySelect` into both `user` (actor) and `targetUser` (subject) sub-selects.

- [ ] **Step 2: Replace name displays in `activity-logs-view.tsx`**

For each row that says "X did Y to Z", replace `X` and `Z` with `<EmployeeIdentity user={...} size="sm" />`. The verb "did Y to" stays as plain text between them.

- [ ] **Step 3: Typecheck + smoke**

Run: `npx tsc --noEmit && npm run dev`. Visit `/activity-logs`. Confirm both actor and target render the identity block.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/activity-logs src/components/activity-logs
git commit -m "feat(activity-logs): show #numId + avatar for actor and target"
```

---

### Task 14: Migrate top-nav and header

**Files:**
- Modify: `src/components/layout/user-nav.tsx`, `src/components/layout/header.tsx`

- [ ] **Step 1: Replace name display in `user-nav.tsx`**

The existing nav already uses `Avatar`. Replace the avatar + name pair with `<EmployeeIdentity user={session.user} size="sm" />`. The session shape must include `numId` and `image` — verify by checking `src/auth.ts` / `src/auth.config.ts` and (if missing) add `numId` and `image` to the JWT/session callback. If the session does not currently carry `numId`, add it: fetch from DB in the `jwt` callback and propagate via the `session` callback. Use `userIdentitySelect` for the DB fetch.

- [ ] **Step 2: Replace name display in `header.tsx`**

Apply the same swap. If `header.tsx` shows the same session user as `user-nav.tsx`, share the component import; do not re-fetch.

- [ ] **Step 3: Typecheck + smoke**

Run: `npx tsc --noEmit && npm run dev`. Log in. Confirm the top-right shows avatar + name + `#ID` in the compact `sm` variant.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout src/auth.ts src/auth.config.ts
git commit -m "feat(layout): show #numId + avatar in top nav via session"
```

---

## Phase 3 — Search consistency

### Task 15: Make `numId` searchable everywhere a name is searchable

**Files:** any client component that has a `<Input placeholder="Search ...">` filtering a user list.

- [ ] **Step 1: Enumerate search boxes**

Run: `grep -rn "Search.*name\|search.*Employee\|placeholder=\"Search" src/components/ | grep -v node_modules`. Identify each surface (likely: `user-table.tsx`, `employee-table.tsx`, `attendance-table.tsx` if filterable, `salary-list.tsx` — already has it, `warnings-management-page.tsx`).

- [ ] **Step 2: Update each matcher**

For every list that filters by name, extend the matcher to also accept `numId`. Example pattern (adapt to local variable names):

```ts
const term = search.trim().toLowerCase();
const visible = users.filter((u) =>
  (u.name ?? "").toLowerCase().includes(term) ||
  String(u.numId ?? "").includes(term),
);
```

Skip surfaces that already include `numId` matching (e.g. `salary-list.tsx` already does this on line ~208).

- [ ] **Step 3: Smoke pass**

Run: `npm run dev`. On each surface where you updated the filter, type a numeric query into the search box and confirm it matches by employee number.

- [ ] **Step 4: Commit**

```bash
git add src/components
git commit -m "feat(search): allow searching by #numId in every employee list"
```

---

## Phase 4 — Final verification and PR

### Task 16: Full verification + open PR

**Files:** none (verification + git).

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: every test passes (including the two new util tests).

- [ ] **Step 2: Typecheck the whole tree**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build completes without errors.

- [ ] **Step 4: Full smoke pass**

Run: `npm run dev`. Visit, in order: `/dashboard`, `/users`, `/users/[id]`, `/employees`, `/attendance`, `/hr/branch-attendance`, `/hr/manage-attendance`, `/hr/pending-attendance`, `/hr/attendance-verification`, `/salary`, `/salary/[id]`, `/advances`, `/leave-requests`, `/warnings`, `/notes/[id]`, `/referrals`, `/activity-logs`. On each: confirm avatar + name + `#ID` is present everywhere a name appears, and there are no leftover duplicate `#numId` text fragments.

- [ ] **Step 5: Push and open PR**

```bash
git push -u origin feature/employee-identity-display
gh pr create --title "feat: show #numId and avatar everywhere an employee name appears" --body "$(cat <<'EOF'
## Summary
- Adds shared `<EmployeeIdentity />` component (avatar + name + `#numId`, three sizes).
- Migrates all ~25 UI surfaces that display employee names: attendance, salary, advances, users/employees, leave, warnings, notes, referrals, activity logs, top nav.
- Adds `userIdentitySelect` Prisma preset to keep payload shape consistent.
- Makes `#numId` searchable in every employee list.

## Out of scope
PDFs, CSV exports, and email templates — UI only, per spec.

## Test plan
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes
- [ ] `npx tsc --noEmit` clean
- [ ] Smoke pass each surface listed above shows avatar + name + #ID
- [ ] Search by employee number works on every list
- [ ] Image fallback (initials on colored bg) shows for users without an uploaded image

Spec: `docs/superpowers/specs/2026-05-21-employee-identity-display-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review (already applied)

- **Spec coverage:** ✓ Every spec section maps to a task. Component (T4), helpers (T1, T2), type + preset (T3), data plumbing + migration (T5–T14), search (T15), verification (T16).
- **Placeholder scan:** ✓ No TBD/TODO. Every code step shows the exact code or a concrete pattern keyed to the local variable shape of the file being edited.
- **Type consistency:** ✓ `EmployeeIdentityUser` shape (`id`, `name`, `numId`, `image`) matches `userIdentitySelect` keys and the component's prop interface. `getInitials` and `stringToHue` signatures match between tests, implementation, and component usage.
- **Realism check:** ✓ Vitest is node-only — no React rendering tests asserted; component is verified by smoke + typecheck. This matches existing project conventions.
