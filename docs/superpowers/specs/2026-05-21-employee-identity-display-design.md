# Employee Identity Display — Design

**Status:** Approved
**Date:** 2026-05-21
**Author:** Kunal Sharma

## Goal

Every UI surface that shows an employee's name must also show their employee number (`#numId`) and their image (with initials fallback). One reusable component drives every site so future tweaks are one-file changes.

## Motivation

- Duplicate first names exist; managers cannot reliably distinguish employees by name alone.
- Two ad-hoc display formats already coexist (`#142` in advances, `(Emp #142)` in salary). The rest of the app shows name-only. Consistency is missing.
- The `User` model already has `numId` (auto-increment int) and `image` (URL) — the data is there; the UI is not surfacing it.

## Non-Goals

- PDF/letter templates, CSV exports, and email bodies are out of scope. UI only.
- No backfill or migration of `numId` or `image` data — both fields are already populated.
- No additional identity fields (department, role, title) inside the card. The component exposes a `subtitle` slot so callers can add their own without touching the component.
- No renaming of `numId` to a friendlier field name.

## Decisions

| Decision | Choice |
|----------|--------|
| Visual format | Avatar (left) + name (top) + `#numId` (muted, below). Stacked. |
| Avatar fallback when no image | Initials on a color derived from a hash of `name` (stable per person). |
| Rollout | One shared component, all ~25 surfaces migrated in a single PR. |
| Data plumbing | Update every server fetch / API route to include `numId` and `image` via a shared Prisma select preset. |
| Non-UI surfaces | Out of scope. |

## Architecture

### Component

**Path:** `src/components/ui/employee-identity.tsx`

```tsx
interface EmployeeIdentityProps {
  user: { id: string; name: string | null; numId: number | null; image: string | null };
  size?: "sm" | "md" | "lg";   // default "md"
  subtitle?: React.ReactNode;  // overrides #ID line — for callers who want a custom subtitle
  href?: string;               // optional Link wrap to user detail page
  className?: string;
}
```

Renders, by size:

- **sm** (24px avatar, single line): `[AV] Rohit Kumar · #142` — for dropdowns, dense rows, comboboxes.
- **md** (32px avatar, two lines): `[AV] Rohit Kumar` / `      #142` — the default. Table rows, list items, dialog headers.
- **lg** (48px avatar, two lines, larger type): page headers and detail pages.

### Avatar behavior

1. If `user.image` is set, render `<img>` inside shadcn `Avatar`.
2. Else render `<AvatarFallback>` with initials.
3. Initials: take first letters of the first and last whitespace-separated tokens of `name`, uppercase, max 2 chars. `"Rohit Kumar"` → `RK`. `"Rohit"` → `R`. `null` → `?`.
4. Fallback background: `hsl(stringToHue(name), 60%, 50%)`. Helper `stringToHue` already exists in `src/components/leave/`; promote it to `src/lib/utils.ts` so the avatar and the leave table share one implementation.
5. If `name` is null, use a neutral gray background and `?` glyph.

### ID line

- Format: `#{numId}` (e.g. `#142`). No prefix, no padding.
- Style: `text-xs text-muted-foreground` at `md`, `text-sm text-muted-foreground` at `lg`, inline `text-muted-foreground` with a `·` separator at `sm`.
- If `numId` is null, the line is omitted (rare — `numId` is auto-increment and non-null in DB; null can occur in TS types pre-`Pick`).

### Type subset

`src/models/models.ts` exports:

```ts
export type EmployeeIdentityUser = Pick<User, "id" | "name" | "numId" | "image">;
```

Wider `User` types satisfy this structurally, so consumers don't need to narrow at every call site.

### Prisma select preset

`src/lib/select-presets.ts` (new file):

```ts
export const userIdentitySelect = {
  id: true,
  name: true,
  numId: true,
  image: true,
} as const;
```

Every list and detail fetch spreads this into its `select` block. If we later add `department` to the identity card, one line changes everywhere.

## Migration plan (single PR)

Touch order, grouped by domain:

1. **Foundation** — add `employee-identity.tsx`, `userIdentitySelect`, promote `stringToHue` to `src/lib/utils.ts`, add unit tests.
2. **Attendance** — `attendance-table.tsx`, `daily-attendance-view.tsx`, `branch-attendance-submissions.tsx`, `attendance-verification-table.tsx`, `shared-attendance-table.tsx`, `attendance-reports.tsx`, plus their server fetches in `src/app/(auth)/attendance/**` and `src/app/(auth)/hr/**`.
3. **Salary** — `salary-list.tsx`, `salary-stats-table.tsx`, `salary-details.tsx`, `salary-management.tsx`, server fetches under `src/app/api/salary/**`.
4. **Advances** — `advance-row.tsx` (replaces the existing inline `#numId` badge), `advance-payments-list.tsx`, `advance-discrepancies.tsx`, plus `src/app/api/advances/**`.
5. **Users / Employees** — `user-table.tsx`, `employee-table.tsx`, `user-actions.tsx`, `user-profile-form.tsx`, `pending-signatures-widget.tsx`, plus `src/app/api/users/**`.
6. **Leave** — `leave-request-table.tsx`, `src/app/api/leave-requests/**`.
7. **Warnings** — `warnings-management-page.tsx`, `src/app/api/warnings/**`.
8. **Notes** — owner + share lists in `NoteDetail.tsx` and the notes API.
9. **Referrals** — referral lists and `src/app/api/referrals/**`.
10. **Activity logs** — `activity-logs-view.tsx`, both actor and target user.
11. **Layout** — `layout/user-nav.tsx`, `layout/header.tsx` — use `size="sm"`.

For each call site:

- Replace `{user.name}` (or the equivalent `<TableCell>{user.name}</TableCell>`) with `<EmployeeIdentity user={user} size="..." />`.
- If the row already shows a separate `numId` (advances), delete the now-redundant element.
- If the API fetch was missing `numId` or `image`, spread `userIdentitySelect` into the `select`.

## Search behavior

Tables that have a name search box must also match `numId.toString()`. Audit existing search inputs in `salary-list.tsx`, `user-table.tsx`, `employee-table.tsx`, `attendance-table.tsx`. Add `numId` matching in the same PR so search consistency tracks display consistency.

## Testing

- Unit tests in `src/components/ui/__tests__/employee-identity.test.tsx`:
  - Renders name, renders `#numId`, hides ID line when `numId` null.
  - Renders `<img>` when `image` is set; renders fallback initials otherwise.
  - Initials extraction: `"Rohit Kumar"` → `RK`, `"Rohit"` → `R`, `null` → `?`.
  - Applies correct CSS classes for each `size`.
- `stringToHue` move: existing leave-table tests must continue to pass; add a unit test in `src/lib/utils.test.ts` if not already covered.
- No snapshot/visual tests (none in the repo today).
- Manual smoke pass on each touched surface in the dev server before merging.

## Out of scope (explicit)

- PDF/letter templates (`offer-letter`, `payslip`, `joining-form`).
- CSV exports (`/api/*/export/route.ts`).
- Email body templates.
- Adding extra identity fields (department, role, title) to the card.
- Renaming `numId` to a different field name.
- Backfilling user images for employees without one — surfaces will fall back to initials, which is acceptable.

## Risk and mitigation

- **Big PR.** ~25 files touched plus matching server-fetch updates. Mitigation: mechanical change, the component encapsulates all formatting logic, and tests cover the component. Reviewer can spot-check a handful of call sites and trust the rest.
- **Stale data in tables.** Some places already paginate user data client-side. Once `image` URLs are added, payloads grow slightly. Acceptable — image URLs are short strings.
- **Avatar HTTP load.** Tables with 60+ employees will fire 60+ image requests on first render. Mitigation: shadcn `Avatar` shows the fallback while loading; lazy-loading via the browser's native `loading="lazy"` is enabled by default in the component. No prefetch needed.
