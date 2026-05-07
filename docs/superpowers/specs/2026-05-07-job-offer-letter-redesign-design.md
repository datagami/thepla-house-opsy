# Job Offer Letter Redesign — Design Spec

**Date:** 2026-05-07
**Status:** Approved (pending implementation plan)
**Owner:** HR / Hiring workflow

## Problem

The current job-offer letter is rendered server-side via pdf-lib (`src/app/api/job-offers/[id]/offer-letter/route.ts`, ~743 lines of manual text layout). It hard-codes the sentence

> "You will not be eligible for National Public Holidays, however, you will be eligible for Two week offs and Four half days in a month."

into every offer. HR cannot tailor terms per offer (e.g., WFH on Saturdays, Sundays off, public-holiday eligibility), and the letter's visual design is plain.

## Goal

1. Add a **new** offer-letter renderer alongside the existing pdf-lib one: a server-rendered React page in the `(print)` route group, styled with print CSS, downloaded via the browser's native `window.print()` save-as-PDF (same pattern as payslips).
2. Adopt the bilingual, brand-styled visual design provided by the user (cream + deep-green + gold, A4 portrait, English/Hindi clause headings, multi-page with separate Annexure A for the CTC breakdown).
3. Replace the hardcoded sentence with a per-offer, HR-authored **Terms & Policies** rich-text field.
4. Provide a snippet library — HR/MANAGEMENT-curated bilingual clauses (working hours, probation, leave, notice, documents) that HR can copy-paste into the offer's editor.
5. Backfill existing offers so they re-print without regression.
6. **Keep the existing pdf-lib renderer in place as a fallback** so HR can compare the two and revert if the new design doesn't work in practice. Removal happens in a follow-up PR after the new design is validated in production.

## Non-Goals (explicit)

- Auto-numbering clauses at render time.
- Storing signatory name in DB (hardcoded "Tejal Mehta, Director, Tejal's Kitchen Pvt. Ltd." for v1).
- Recipient address column on `JobOffer` (skipped in v1; the reference design includes it but our `User` model does not store one).
- Public/tokenized link for candidates.
- E-signature workflow.
- Audit log UI for snippet edits (`createdBy` / `updatedBy` stored but not surfaced).
- Removal of legacy `halfDays` / `weekOff` columns (used by backfill, kept dormant; cleanup PR can drop them later).
- Removal of the existing pdf-lib renderer (`src/app/api/job-offers/[id]/offer-letter/route.ts`). Kept as a fallback this PR; cleanup in a follow-up after the new design is validated.

## Architecture

### Visual reference

The user supplied a self-contained HTML mockup (`Offer Letter — Priya Sharma — Thepla House`). Key visual properties extracted from the print stylesheet:

- **A4 portrait**, multi-page, `@page { size: A4 portrait; margin: 0 }` — the `.page` element handles its own padding (`18mm 18mm 16mm`).
- **Palette:** `--cream: hsl(39 100% 97%)`, `--green: hsl(147 41% 16%)`, `--green-deep: hsl(147 45% 12%)`, `--gold: hsl(38 80% 55%)`, plus ink-1..4 grays.
- **Typography:** Inter (body), Epilogue (display headings, 700–800 weight), Noto Sans Devanagari (Hindi). All three loaded from Google Fonts via `<link>`.
- **Brand cue:** thin 2px gold stripe down the left margin of every page (`.page::before`).
- **Bilingual clause heads:** every clause has English title (Epilogue 700, deep green) + Hindi subtitle (Noto Sans Devanagari, ink-3).
- **Print-safe:** `-webkit-print-color-adjust: exact`, `page-break-after: always` on `.page`, `break-inside: avoid` on `.clause`, `.comp-table`, `.ctc-table`, `.sign-block`, `.accept`, `.ctc-summary`.

### Body split

| Block | Source | Notes |
|---|---|---|
| Letterhead, ref, date, recipient, salutation, subject | Structured (`User` + `JobOffer`) | Hardcoded company name/address/contact for v1 |
| **Clause 01 — Position & Date of Joining** | Structured | Interpolates `designation`, `branch`/`department`, `joiningDate` |
| **Clause 02 — Compensation table** | Structured | Renders from `JobOffer.salaryComponents` JSON; falls back to legacy `basicPerMonth` / `otherAllowancesPerMonth` |
| **Clauses 03–07+** | `JobOffer.termsHtml` (rich text via Jodit) | HR composes via snippet library |
| Closing + signature + acceptance + page footer | Structured | Hardcoded copy + signatory; CSS-rendered stamp |
| **Annexure A — Detailed CTC** | Structured (`salaryComponents` + `deductions`) | 3-tile summary + multi-section table |

### File layout

**Create:**
- `src/app/(print)/job-offers/[id]/page.tsx` — server-rendered print page; HR/MANAGEMENT auth gate.
- `src/app/(print)/job-offers/[id]/offer-letter.css` — port of the reference CSS.
- `src/app/(auth)/job-offers/[id]/letter/page.tsx` — wrapper page in normal app chrome with an "Open Print View" link.
- `src/app/(auth)/admin/offer-letter-snippets/page.tsx`, `[id]/edit/page.tsx`, `new/page.tsx` — list + create/edit UI.
- `src/app/api/offer-letter-snippets/route.ts` — `GET` (list active or all), `POST` (create).
- `src/app/api/offer-letter-snippets/[id]/route.ts` — `PATCH`, `DELETE`.
- `src/components/job-offers/snippet-panel.tsx` — sidebar component.
- `src/lib/services/offer-letter.ts` — pure helpers: `buildReferenceNo`, `formatLetterDate`, `sanitizeOfferHtml`, `computeAnnexureSummary`.
- `src/lib/services/__tests__/offer-letter.test.ts` — unit tests.
- `src/app/api/offer-letter-snippets/__tests__/route.test.ts` — integration tests.
- `src/app/api/job-offers/__tests__/terms-html.test.ts` — integration tests for the new field.
- `prisma/seed-offer-snippets.ts` — idempotent seeder.

**Modify:**
- `src/components/job-offers/job-offer-form.tsx` — add Terms & Policies section (RichTextEditor + SnippetPanel); remove the `halfDays` / `weekOff` numeric inputs.
- `src/components/job-offers/job-offer-actions.tsx` — keep the existing "Download Offer Letter (PDF)" item (pdf-lib) and add a new **"Open Letter (New Design)"** item linking to the `(print)` route. Both available side by side until the new design is validated.
- `src/app/api/job-offers/route.ts`, `src/app/api/job-offers/[id]/route.ts` — accept `termsHtml`; sanitize via `sanitizeOfferHtml` on save; reject empty after sanitization with 400.
- `prisma/schema.prisma` — add `termsHtml`, `OfferLetterSnippet` model, `OfferLetterSnippetCategory` enum, inverse relations on `User`.
- `package.json` — add `db:seed:offer-snippets` script.

**Keep (do not delete in this PR):**
- `src/app/api/job-offers/[id]/offer-letter/route.ts` — the existing pdf-lib renderer. Stays available as a fallback for HR to compare against the new design. Slated for removal in a follow-up PR.

**New deps:**
- `isomorphic-dompurify` — sanitizer; runs both server (on save) and client (preview pane in admin UI).

## Schema Changes

### Migration: `add_offer_terms_html_and_snippets`

```prisma
model JobOffer {
  // ... existing fields unchanged ...

  termsHtml String? @db.Text @map("terms_html")  // sanitized HTML; HR-authored body for Clauses 03+
  // halfDays and weekOff KEPT as legacy. Marked deprecated; cleanup in a follow-up PR.
}

enum OfferLetterSnippetCategory {
  WORKING_HOURS
  PROBATION
  LEAVE
  NOTICE
  DOCUMENTS
  CONFIDENTIALITY
  OTHER
}

model OfferLetterSnippet {
  id        String                       @id @default(cuid())
  numId     Int                          @default(autoincrement()) @map("num_id")
  title     String                       // human-readable, e.g. "Probation — 3 months"
  category  OfferLetterSnippetCategory   @default(OTHER)
  htmlBody  String                       @db.Text @map("html_body")
  isActive  Boolean                      @default(true) @map("is_active")
  sortOrder Int                          @default(0) @map("sort_order")

  createdById String? @map("created_by_id")
  updatedById String? @map("updated_by_id")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  createdBy User? @relation("OfferLetterSnippetCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  updatedBy User? @relation("OfferLetterSnippetUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull)

  @@index([isActive, sortOrder])
  @@map("offer_letter_snippets")
}

// Inverse relations on User:
model User {
  // ... existing relations ...
  offerLetterSnippetsCreated OfferLetterSnippet[] @relation("OfferLetterSnippetCreatedBy")
  offerLetterSnippetsUpdated OfferLetterSnippet[] @relation("OfferLetterSnippetUpdatedBy")
}
```

### Migration body (additions to the schema diff)

Backfill `terms_html` on existing offers using the legacy hardcoded sentence, wrapped as a single bilingual `<section class="clause">` so it renders consistently in the new print page. Idempotent via `WHERE terms_html IS NULL`.

```sql
UPDATE "JobOffer"
SET "terms_html" = CONCAT(
  '<section class="clause"><div class="clause-head">',
  '<span class="num-mark">03</span>',
  '<span class="title-en">Working Hours &amp; Holidays</span>',
  '<span class="title-hi hi">कार्य समय एवं अवकाश</span>',
  '</div><p class="body">You will not be eligible for National Public Holidays. ',
  'However, you will be eligible for ', "week_off", ' week off',
  CASE WHEN "week_off" = 1 THEN '' ELSE 's' END,
  ' and ', "half_days", ' half day',
  CASE WHEN "half_days" = 1 THEN '' ELSE 's' END,
  ' in a month.</p></section>'
)
WHERE "terms_html" IS NULL;
```

### Why these design choices

- **Nullable `termsHtml`** — distinguishes "never edited" (null, before backfill) from "explicitly empty" (empty string, blocked by validation). After backfill all rows are populated.
- **`category` enum** — lets the snippet panel group entries; default `OTHER` so HR can add ad-hoc clauses without forcing a category.
- **`sortOrder`** — controls panel ordering; matches the implicit order of the reference design (working hours → probation → leave → notice → documents).
- **Hard delete on snippets** — they're reusable templates, not historical records. Once gone, gone.

## Print Page Rendering

### Layout (top → bottom)

1. **Page 1 (`<div class="page">`)**:
   1. `.letterhead` — circular logo (`/thepla-logo.png` from `public/`), name, tagline, address, contacts. Static.
   2. `.ref-row` — Ref. No. = `TH/HR/${offerYear}/${String(numId).padStart(4, '0')}`; Date = `formatLetterDate(offerDate)`.
   3. `.doc-title` — "Offer of Employment" / "नियुक्ति का प्रस्ताव पत्र" + gold underline.
   4. `.to-block` — recipient name (with `titlePrefix(user.gender)`); address skipped in v1.
   5. `.salutation` + `.subject`.
   6. Two intro paragraphs interpolating `name`, `designation`, `branch`, `joiningDate`.
   7. **Clause 01** (structured).
   8. **Clause 02** (structured) with `.comp-table` from `salaryComponents`.
   9. `<div class="terms" dangerouslySetInnerHTML>` — sanitized `termsHtml`.
   10. `.page-foot`.
2. **Page 2 (`<div class="page">`)**:
   1. Mini letterhead.
   2. Closing paragraph.
   3. "Yours sincerely / भवदीय,".
   4. `.sign-block` (signatory + CSS-rendered `.stamp`).
   5. `.accept` block with signature lines.
   6. `.page-foot`.
3. **Annexure A (`<div class="page">`)**:
   1. Mini letterhead with "Annexure A · Ref. {ref}".
   2. `.annex-title`.
   3. `.ctc-summary` — 3 tiles (Gross/Month, Total CTC/Annum, Take-home/Month).
   4. `.ctc-table` — Section A (Fixed Earnings, from `salaryComponents`), Subtotal, Section B (Employer Contributions, from `deductions` filtered by employer flag — fall back: hardcode PF + bonus rows from legacy data if the JSON doesn't carry an employer flag), Grand Total CTC, Section C (Statutory Deductions), Take-home subtotal.
   5. `.annex-note` with legal footnotes.
   6. `.page-foot`.

The structured intro + Clause 01 + Clause 02 + injected `termsHtml` + closing all live in **one logical `<div class="page">`** for the body content. The browser may print this across 1, 2, or 3 sheets depending on `termsHtml` length; `break-inside: avoid` rules keep individual clauses together.

### Sanitization

`sanitizeOfferHtml(html: string): string` (in `src/lib/services/offer-letter.ts`).

- **Allowed tags:** `section`, `div`, `span`, `p`, `ul`, `ol`, `li`, `strong`, `b`, `em`, `i`, `u`, `br`, `h3`, `h4`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `a`.
- **Allowed attributes:** `class`, `style`, `href`, `colspan`, `rowspan`. `<a>` gets `rel="noopener noreferrer"` forced.
- **Allowed URI scheme:** `^(https?:\/\/|mailto:|tel:|#)/i`. Anything else stripped from `href`.
- **Class allowlist:** the `.clause`, `.clause-head`, `.title-en`, `.title-hi`, `.hi`, `.num-mark`, `.body`, `.num` family from the print stylesheet, plus utility classes used in seeded snippets. Unknown classes are dropped.
- **Forbidden:** `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<style>`, `<head>`, `<body>`, all `on*` event handlers.

Sanitization runs **on save** in the API route (primary defense — DB never holds unsafe HTML) AND **on render** in `page.tsx` (defense in depth for legacy rows).

### `PrintButton`

`window.print()`. Browser handles save-as-PDF. **No auto-print on load** — HR may want to review first.

## Snippet Library

### Management UI (`/admin/offer-letter-snippets`)

HR/MANAGEMENT only. List page: title, category, isActive toggle, sort order, updatedBy/at, edit/delete actions. Edit page: title (max 80), category (`<Select>` from enum), HTML body (Jodit), sort order, isActive. Live preview pane beside the editor, rendering sanitized HTML scoped via a `.terms-preview` wrapper that pulls the same print-stylesheet styles.

Validation: title required; HTML body non-empty after sanitization. Duplicate titles allowed but flagged with a soft warning.

### Seed snippets

`prisma/seed-offer-snippets.ts` — idempotent (`upsert` keyed on title). Run via `npm run db:seed:offer-snippets`.

Seeds 5 default bilingual snippets matching the reference design:

| # | Title | Category | sortOrder |
|---|---|---|---|
| 1 | Working Hours & Location | `WORKING_HOURS` | 10 |
| 2 | Probation — 3 months | `PROBATION` | 20 |
| 3 | Leave Policy — Standard | `LEAVE` | 30 |
| 4 | Notice Period — 30 days | `NOTICE` | 40 |
| 5 | Documents Required at Joining | `DOCUMENTS` | 50 |

Each seed body uses the exact `<section class="clause">` markup from the reference design with bilingual headings.

### Snippet panel (offer form sidebar)

Fetches active snippets via `GET /api/offer-letter-snippets`. Grouped by category, sorted by `sortOrder`. Each row has a Copy button → `navigator.clipboard.writeText(snippet.htmlBody)` + `toast.success('Copied — paste into the editor.')`. "Manage snippets" deep-link visible to HR/MANAGEMENT.

### API contracts

- `GET /api/offer-letter-snippets` → `{ snippets: { id, title, category, htmlBody, sortOrder, isActive }[] }`. Active-only by default; `?all=true` for the admin list.
- `POST /api/offer-letter-snippets` → 201 with the created row. Sanitizes `htmlBody`.
- `PATCH /api/offer-letter-snippets/:id` → partial body. Sanitizes `htmlBody` if present.
- `DELETE /api/offer-letter-snippets/:id` → 204. Hard delete.

All four routes gated to HR/MANAGEMENT.

## Form / UX Changes

`src/components/job-offers/job-offer-form.tsx` (currently 741 lines).

### Schema additions

```ts
termsHtml: z.string().min(1, 'Terms & Policies cannot be empty').default(''),
```

### Layout

Add a **"Terms & Policies"** section between "Benefits" and "Notes":

- Left column (flex-1, min 480px tall): `<RichTextEditor value={form.watch('termsHtml')} onChange={v => form.setValue('termsHtml', v)} />`.
- Right column (`280px` fixed on `md+`, stacks below on mobile): `<SnippetPanel onCopy={(html) => navigator.clipboard.writeText(html)} />`.
- Help line under the section: "Click 'Copy' on a snippet, then paste into the editor."

Remove the `halfDays` and `weekOff` numeric inputs from the form. `foodAndStayProvided` toggle stays. `notes` textarea stays as HR-internal.

### Submit flow

API route runs `sanitizeOfferHtml` server-side. If the result is empty (HR pasted only `<script>` content), 400 with `Terms & Policies must contain at least one paragraph after sanitization`.

### "View Letter" actions (two side-by-side)

`job-offer-actions.tsx` exposes both renderers during the validation window:

- **"Open Letter (New Design)"** — opens `/print/job-offers/[id]` in a new tab; `<PrintButton />` triggers `window.print()`.
- **"Download Offer Letter (PDF)"** — kept as-is; calls the existing pdf-lib API. Labeled to make the distinction obvious to HR.

When the new design is validated and the legacy renderer is removed (follow-up PR), the second item goes away.

## Edge Cases

| Case | Behavior |
|---|---|
| `salaryComponents` is null | Comp table falls back to legacy `basicPerMonth` / `otherAllowancesPerMonth`. If those are null, single row "Gross Monthly Salary" = `totalSalary / 12`. |
| `deductions` is null | Annexure C-section omitted; Take-home tile shows "—". |
| `User.gender` is null | `titlePrefix` returns `""`; salutation reads `Dear {name},`. |
| `branch` is null | Subject + Clause 01 use "the assigned location"; Annexure unaffected. |
| `joiningDate` is null | Subject + intro use "the date communicated separately"; offer can still be saved. |
| `termsHtml` empty after sanitization | 400 on save. Print page renders `<aside class="muted">No additional terms specified.</aside>` for any legacy row that slipped through. |
| Pasted HTML is huge | DB column is `TEXT` (no length cap). Sanitizer strips `<style>` / `<head>` / `<body>` wrappers. |
| Offer re-printed for a `JOB_OFFER`-status user who has since changed status | Allowed. Letter is historical and re-printable any time. |
| Two snippets with the same title | Allowed; soft warning in admin UI. |
| Snippet deleted while a draft is open | Already-pasted content unaffected. Panel just stops listing it. |

## Testing

### Unit (`src/lib/services/__tests__/offer-letter.test.ts`)

- `buildReferenceNo(numId=42, offerDate=2026-05-07)` → `'TH/HR/2026/0042'`.
- `formatLetterDate(2026-05-07)` → `'7 May 2026'`.
- `sanitizeOfferHtml`:
  - Strips `<script>`, `onerror=`, `javascript:` href.
  - Preserves `<section class="clause">`, `<ul>`, `<strong>`, allowed classes.
  - Drops unknown classes (`<div class="hidden">` → `<div>`).
  - Allows `<a href="https://...">`, blocks `<a href="javascript:...">`.
- `computeAnnexureSummary`:
  - Given `salaryComponents` totaling 18000/mo and `deductions` totaling 1496/mo → gross 18000, take-home 16504, CTC = annual gross + employer contributions.

### Integration (`src/app/api/offer-letter-snippets/__tests__/route.test.ts`)

- Non-HR session → 401 on all four routes.
- POST with `<script>` in `htmlBody` → row stored without script tag.
- Round-trip: create → list → patch → delete → list.

### Integration (`src/app/api/job-offers/__tests__/terms-html.test.ts`)

- POST `/api/job-offers` with `termsHtml` containing `<script>` → row stored sanitized.
- PATCH with empty `termsHtml` after sanitization → 400 with documented error.

### Manual UAT

1. Create offer, paste all 5 snippets, save → open print view → confirm letterhead, Clauses 01–02 + 5 snippet clauses + Annexure A render correctly. Save as PDF → verify A4 layout, gold left stripe, footers visible.
2. Existing PENDING offer (post-backfill) → renders Clause 03 with the legacy bilingual sentence.
3. Snippet admin: create / edit / deactivate / reactivate → form panel updates accordingly.
4. HR pastes a snippet, types extra paragraphs, saves, re-opens → content round-trips loss-lessly.
5. Try saving an offer with empty `termsHtml` → form shows validation error; API rejects with 400.
6. Try saving a snippet with `<script>alert(1)</script>` only → API rejects with documented error.

## Open Questions

None. Recipient address column, signatory persistence, and clause auto-numbering are explicit follow-ups, listed under Non-Goals.
