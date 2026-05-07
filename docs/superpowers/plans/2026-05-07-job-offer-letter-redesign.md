# Job Offer Letter Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new bilingual (EN+HI) print-styled offer letter rendered the payslip way (server React + window.print). Replace the hardcoded "Two week offs / Four half days" sentence with a per-offer rich-text Terms & Policies field, plus an HR-curated snippet library. Keep the existing pdf-lib renderer in place this PR as a fallback.

**Architecture:** New `(print)/job-offers/[id]` route group page renders letterhead + structured Clauses 01–02 + injected sanitized `termsHtml` + signature block + Annexure A. New `OfferLetterSnippet` table powers a sidebar in the offer form where HR copies bilingual clauses to the clipboard and pastes into Jodit. All HTML sanitized server-side (DOMPurify) on save and on render. Existing pdf-lib route stays available; the actions menu exposes both renderers.

**Tech Stack:** Next.js 15 App Router (route groups), Prisma, Jodit (existing), `isomorphic-dompurify` (new), pdf-lib (existing — kept as fallback), shadcn UI, sonner.

**Spec:** `docs/superpowers/specs/2026-05-07-job-offer-letter-redesign-design.md`
**Branch:** `feature/job-offer-letter-redesign` (already created)

---

## File Structure

**Create:**

- `prisma/schema.prisma` — additions only (one consolidated migration).
- `prisma/migrations/<ts>_add_offer_terms_html_and_snippets/migration.sql` — schema diff + backfill SQL.
- `prisma/seed-offer-snippets.ts` — idempotent seed for the 5 default snippets.
- `src/lib/services/offer-letter.ts` — pure helpers: `buildReferenceNo`, `formatLetterDate`, `sanitizeOfferHtml`, `computeAnnexureSummary`, `numberToWords` (move from pdf-lib route).
- `src/lib/services/__tests__/offer-letter.test.ts` — unit tests.
- `src/app/api/offer-letter-snippets/route.ts` — `GET`, `POST`.
- `src/app/api/offer-letter-snippets/[id]/route.ts` — `PATCH`, `DELETE`.
- `src/app/api/offer-letter-snippets/__tests__/route.test.ts` — integration tests.
- `src/app/api/job-offers/__tests__/terms-html.test.ts` — integration tests for the new field.
- `src/app/(print)/job-offers/[id]/page.tsx` — server-rendered print page.
- `src/app/(print)/job-offers/[id]/offer-letter.css` — port of the reference CSS.
- `src/app/(auth)/admin/offer-letter-snippets/page.tsx` — list page.
- `src/app/(auth)/admin/offer-letter-snippets/new/page.tsx` — create page.
- `src/app/(auth)/admin/offer-letter-snippets/[id]/edit/page.tsx` — edit page.
- `src/components/admin/offer-letter-snippets/snippet-list.tsx` — table component.
- `src/components/admin/offer-letter-snippets/snippet-form.tsx` — form with editor + preview.
- `src/components/job-offers/snippet-panel.tsx` — sidebar in the offer form.
- `src/components/job-offers/print-button.tsx` — local copy of the salary `PrintButton` (or generalize).

**Modify:**

- `src/components/job-offers/job-offer-form.tsx` — add Terms & Policies section, remove `halfDays` / `weekOff` numeric inputs.
- `src/components/job-offers/job-offer-actions.tsx` — add "Open Letter (New Design)" item alongside the existing "Download Offer Letter" item.
- `src/app/api/job-offers/route.ts` — accept + sanitize `termsHtml`.
- `src/app/api/job-offers/[id]/route.ts` — accept + sanitize `termsHtml`.
- `package.json` — add `db:seed:offer-snippets` script + `isomorphic-dompurify` dependency.

**Keep (do not delete):**

- `src/app/api/job-offers/[id]/offer-letter/route.ts` — pdf-lib renderer; fallback for HR comparison.

---

## Conventions Used Throughout

- **Auth:** HR/MANAGEMENT only on every new route. Pattern:
  ```ts
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  ```
- **Sanitization:** every HTML input runs through `sanitizeOfferHtml` server-side **on save**. The print page sanitizes again on render (defense in depth).
- **Sheet split for the print page:** ONE `<div class="page">` block per logical sheet (Page 1 letter body, Page 2 closing+signature, Annexure A).
- **Reference number format:** `TH/HR/${year}/${String(numId).padStart(4, '0')}` from `JobOffer.numId` and `offerDate.year`.
- **Date format on the letter:** `7 May 2026` (en-GB long format).
- **Tests:** vitest. Test files live under `src/**/__tests__/**/*.test.ts` per `vitest.config.ts`.
- **Route runtime:** the print page is a server component (default Next 15 behavior); no special `runtime` exports needed. The new API routes are normal Edge-incompatible Node routes (no special config).

---

### Task 1: Install DOMPurify and add typing

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependency**

Run:
```bash
npm install isomorphic-dompurify
```

Expected: package added to `dependencies`. No engines warning.

- [ ] **Step 2: Verify TypeScript types resolve**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add isomorphic-dompurify for offer letter sanitization"
```

---

### Task 2: Schema migration — `termsHtml` column + `OfferLetterSnippet` table

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Edit `prisma/schema.prisma`**

Add the enum at the top of the file alongside other enums (after `JobOfferStatus`):

```prisma
enum OfferLetterSnippetCategory {
  WORKING_HOURS
  PROBATION
  LEAVE
  NOTICE
  DOCUMENTS
  CONFIDENTIALITY
  OTHER
}
```

Inside the existing `model JobOffer { ... }` block, after the `notes String? @db.Text` line, add:

```prisma
  termsHtml String? @db.Text @map("terms_html")
```

Add the new model below `JobOffer` (before `@@map("job_offers")` if needed, but as a separate model declaration):

```prisma
model OfferLetterSnippet {
  id        String                       @id @default(cuid())
  numId     Int                          @default(autoincrement()) @map("num_id")
  title     String
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
```

Inside the existing `model User { ... }` block, alongside other relation lists (e.g., near `jobOffers JobOffer[]`), add:

```prisma
  offerLetterSnippetsCreated OfferLetterSnippet[] @relation("OfferLetterSnippetCreatedBy")
  offerLetterSnippetsUpdated OfferLetterSnippet[] @relation("OfferLetterSnippetUpdatedBy")
```

- [ ] **Step 2: Generate the migration**

Run:
```bash
npx prisma migrate dev --name add_offer_terms_html_and_snippets --create-only
```

Expected: a new directory under `prisma/migrations/<timestamp>_add_offer_terms_html_and_snippets/` containing `migration.sql`. The `--create-only` flag means we will edit the SQL before applying.

- [ ] **Step 3: Append the backfill UPDATE to the migration file**

Open the generated `migration.sql` and append at the end:

```sql
-- Backfill termsHtml for existing offers using legacy halfDays/weekOff.
-- Bilingual clause matching the new print stylesheet so the existing offers
-- re-render in the new design without surprises.
UPDATE "job_offers"
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

(Verify the table name in the generated SQL is `"job_offers"` — Prisma uses the `@@map` value. If the column names in the generated SQL are unquoted, drop the quotes around `"week_off"`, `"half_days"`, `"terms_html"` to match.)

- [ ] **Step 4: Apply the migration**

Run:
```bash
npx prisma migrate dev
```

Expected: migration applies cleanly. Prisma client regenerates. No data loss.

- [ ] **Step 5: Verify the schema**

Run:
```bash
npx prisma studio
```

Expected: `JobOffer` shows a `termsHtml` column populated with the bilingual sentence for any existing rows. `OfferLetterSnippet` table exists, empty.

Close Prisma Studio.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(offer-letter): add termsHtml + OfferLetterSnippet schema with backfill"
```

---

### Task 3: Sanitization helpers (TDD)

**Files:**
- Create: `src/lib/services/offer-letter.ts`
- Create: `src/lib/services/__tests__/offer-letter.test.ts`

- [ ] **Step 1: Write failing tests for `sanitizeOfferHtml`**

Create `src/lib/services/__tests__/offer-letter.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sanitizeOfferHtml } from '@/lib/services/offer-letter'

describe('sanitizeOfferHtml', () => {
  it('preserves the clause structure used by the print stylesheet', () => {
    const html = '<section class="clause"><div class="clause-head">' +
      '<span class="num-mark">03</span>' +
      '<span class="title-en">Working Hours</span>' +
      '<span class="title-hi hi">कार्य समय</span>' +
      '</div><p class="body">9 to 6.</p></section>'
    const out = sanitizeOfferHtml(html)
    expect(out).toContain('<section class="clause">')
    expect(out).toContain('<span class="num-mark">')
    expect(out).toContain('कार्य समय')
    expect(out).toContain('<p class="body">')
  })

  it('strips <script> tags', () => {
    const out = sanitizeOfferHtml('<p>Hi</p><script>alert(1)</script>')
    expect(out).not.toContain('<script>')
    expect(out).toContain('<p>Hi</p>')
  })

  it('strips javascript: hrefs', () => {
    const out = sanitizeOfferHtml('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toContain('javascript:')
  })

  it('strips on* event handlers', () => {
    const out = sanitizeOfferHtml('<p onclick="alert(1)">Hi</p>')
    expect(out).not.toMatch(/onclick/i)
  })

  it('strips <iframe>, <object>, <embed>, <form>', () => {
    const out = sanitizeOfferHtml(
      '<iframe src="x"></iframe><object></object><embed><form></form>'
    )
    expect(out).not.toContain('<iframe')
    expect(out).not.toContain('<object')
    expect(out).not.toContain('<embed')
    expect(out).not.toContain('<form')
  })

  it('preserves https://, mailto:, tel:, and # hrefs', () => {
    const out = sanitizeOfferHtml(
      '<a href="https://example.com">a</a>' +
      '<a href="mailto:x@y.com">b</a>' +
      '<a href="tel:+91123">c</a>' +
      '<a href="#anchor">d</a>'
    )
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('href="mailto:x@y.com"')
    expect(out).toContain('href="tel:+91123"')
    expect(out).toContain('href="#anchor"')
  })

  it('returns empty string for empty / whitespace input', () => {
    expect(sanitizeOfferHtml('')).toBe('')
    expect(sanitizeOfferHtml('   ').trim()).toBe('')
  })

  it('returns empty string when only forbidden content is given', () => {
    expect(sanitizeOfferHtml('<script>alert(1)</script>').trim()).toBe('')
  })

  it('preserves <ul>, <ol>, <li>, <strong>, <em>, <table>', () => {
    const html = '<ul><li><strong>Bold</strong></li></ul>' +
      '<table><thead><tr><th>H</th></tr></thead>' +
      '<tbody><tr><td>D</td></tr></tbody></table>'
    const out = sanitizeOfferHtml(html)
    expect(out).toContain('<ul>')
    expect(out).toContain('<li>')
    expect(out).toContain('<strong>')
    expect(out).toContain('<table>')
    expect(out).toContain('<th>')
  })
})
```

- [ ] **Step 2: Run tests — they should fail (function not exported)**

Run: `npx vitest run src/lib/services/__tests__/offer-letter.test.ts`
Expected: FAIL with "sanitizeOfferHtml is not a function" or import error.

- [ ] **Step 3: Implement `sanitizeOfferHtml`**

Create `src/lib/services/offer-letter.ts`:

```ts
import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = [
  'section', 'div', 'span', 'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'strong', 'b', 'em', 'i', 'u',
  'h3', 'h4', 'h5',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a',
]

const ALLOWED_ATTR = [
  'class', 'style', 'href', 'colspan', 'rowspan', 'align',
]

const ALLOWED_URI_REGEXP = /^(?:https?:\/\/|mailto:|tel:|#)/i

export function sanitizeOfferHtml(input: string): string {
  if (!input) return ''
  const cleaned = DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'style', 'link', 'meta'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    KEEP_CONTENT: true,
  }) as unknown as string
  return cleaned
}
```

- [ ] **Step 4: Run tests — should pass**

Run: `npx vitest run src/lib/services/__tests__/offer-letter.test.ts`
Expected: All 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/offer-letter.ts src/lib/services/__tests__/offer-letter.test.ts
git commit -m "feat(offer-letter): add HTML sanitizer service with tests"
```

---

### Task 4: `buildReferenceNo` + `formatLetterDate` (TDD)

**Files:**
- Modify: `src/lib/services/offer-letter.ts`
- Modify: `src/lib/services/__tests__/offer-letter.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `src/lib/services/__tests__/offer-letter.test.ts`:

```ts
import { buildReferenceNo, formatLetterDate } from '@/lib/services/offer-letter'

describe('buildReferenceNo', () => {
  it('zero-pads numId to 4 digits', () => {
    expect(buildReferenceNo(42, new Date('2026-05-07'))).toBe('TH/HR/2026/0042')
  })

  it('preserves 4+ digit numIds without truncation', () => {
    expect(buildReferenceNo(12345, new Date('2026-01-01'))).toBe('TH/HR/2026/12345')
  })

  it('uses the offerDate year', () => {
    expect(buildReferenceNo(1, new Date('2024-12-31'))).toBe('TH/HR/2024/0001')
  })
})

describe('formatLetterDate', () => {
  it('formats as en-GB long', () => {
    expect(formatLetterDate(new Date('2026-05-07'))).toBe('7 May 2026')
  })

  it('handles single-digit day', () => {
    expect(formatLetterDate(new Date('2026-01-09'))).toBe('9 January 2026')
  })

  it('handles double-digit day', () => {
    expect(formatLetterDate(new Date('2026-12-25'))).toBe('25 December 2026')
  })
})
```

- [ ] **Step 2: Run — should fail**

Run: `npx vitest run src/lib/services/__tests__/offer-letter.test.ts -t "buildReferenceNo|formatLetterDate"`
Expected: FAIL with import errors.

- [ ] **Step 3: Implement**

Append to `src/lib/services/offer-letter.ts`:

```ts
export function buildReferenceNo(numId: number, offerDate: Date): string {
  const year = offerDate.getFullYear()
  const padded = String(numId).padStart(4, '0')
  return `TH/HR/${year}/${padded}`
}

export function formatLetterDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
```

- [ ] **Step 4: Run — should pass**

Run: `npx vitest run src/lib/services/__tests__/offer-letter.test.ts`
Expected: All 15 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/offer-letter.ts src/lib/services/__tests__/offer-letter.test.ts
git commit -m "feat(offer-letter): add reference-no and date formatters"
```

---

### Task 5: `computeAnnexureSummary` (TDD)

**Files:**
- Modify: `src/lib/services/offer-letter.ts`
- Modify: `src/lib/services/__tests__/offer-letter.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `src/lib/services/__tests__/offer-letter.test.ts`:

```ts
import { computeAnnexureSummary } from '@/lib/services/offer-letter'

describe('computeAnnexureSummary', () => {
  it('computes gross/CTC/take-home from components and deductions', () => {
    const r = computeAnnexureSummary({
      salaryComponents: [
        { name: 'Basic',     perAnnum: 129600, perMonth: 10800 },
        { name: 'HRA',       perAnnum:  51840, perMonth:  4320 },
        { name: 'Conveyance',perAnnum:  19200, perMonth:  1600 },
        { name: 'Special',   perAnnum:  15360, perMonth:  1280 },
      ],
      deductions: [
        { name: 'PF (Employee)',     perAnnum: 15552, perMonth: 1296 },
        { name: 'Professional Tax',  perAnnum:  2500, perMonth:  200 },
      ],
      totalSalary: 229176,
    })

    expect(r.grossPerMonth).toBe(18000)
    expect(r.totalCtcPerAnnum).toBe(229176)
    expect(r.takeHomePerMonth).toBe(16504) // 18000 - 1296 - 200
  })

  it('handles null/empty deductions (take-home = gross)', () => {
    const r = computeAnnexureSummary({
      salaryComponents: [{ name: 'Gross', perAnnum: 240000, perMonth: 20000 }],
      deductions: null,
      totalSalary: 240000,
    })
    expect(r.grossPerMonth).toBe(20000)
    expect(r.takeHomePerMonth).toBe(20000)
  })

  it('falls back to totalSalary/12 when no salaryComponents', () => {
    const r = computeAnnexureSummary({
      salaryComponents: null,
      deductions: null,
      totalSalary: 240000,
    })
    expect(r.grossPerMonth).toBe(20000)
    expect(r.totalCtcPerAnnum).toBe(240000)
  })
})
```

- [ ] **Step 2: Run — should fail**

Run: `npx vitest run src/lib/services/__tests__/offer-letter.test.ts -t "computeAnnexureSummary"`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `src/lib/services/offer-letter.ts`:

```ts
export interface SalaryComponent {
  name: string
  perAnnum: number
  perMonth: number
}

export interface AnnexureInput {
  salaryComponents: SalaryComponent[] | null
  deductions: SalaryComponent[] | null
  totalSalary: number
}

export interface AnnexureSummary {
  grossPerMonth: number
  totalCtcPerAnnum: number
  takeHomePerMonth: number
}

export function computeAnnexureSummary(input: AnnexureInput): AnnexureSummary {
  const components = input.salaryComponents ?? []
  const deductions = input.deductions ?? []

  const grossPerMonth = components.length > 0
    ? Math.round(components.reduce((s, c) => s + c.perMonth, 0))
    : Math.round(input.totalSalary / 12)

  const monthlyDeductions = Math.round(
    deductions.reduce((s, d) => s + d.perMonth, 0)
  )

  return {
    grossPerMonth,
    totalCtcPerAnnum: Math.round(input.totalSalary),
    takeHomePerMonth: grossPerMonth - monthlyDeductions,
  }
}
```

- [ ] **Step 4: Run — should pass**

Run: `npx vitest run src/lib/services/__tests__/offer-letter.test.ts`
Expected: All 18 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/offer-letter.ts src/lib/services/__tests__/offer-letter.test.ts
git commit -m "feat(offer-letter): add Annexure summary calculator"
```

---

### Task 6: Snippet API — `GET` + `POST`

**Files:**
- Create: `src/app/api/offer-letter-snippets/route.ts`
- Create: `src/app/api/offer-letter-snippets/__tests__/route.test.ts`

- [ ] **Step 1: Write failing integration tests**

Create `src/app/api/offer-letter-snippets/__tests__/route.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest'
import { GET, POST } from '@/app/api/offer-letter-snippets/route'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

vi.mock('@/auth', () => ({ auth: vi.fn() }))

afterEach(async () => {
  await prisma.offerLetterSnippet.deleteMany({
    where: { title: { startsWith: '__test_' } },
  })
  vi.resetAllMocks()
})

function asHR() {
  ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'hr-1', role: 'HR' },
  })
}

function asEmployee() {
  ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'e-1', role: 'EMPLOYEE' },
  })
}

describe('GET /api/offer-letter-snippets', () => {
  it('returns 401 for non-HR sessions', async () => {
    asEmployee()
    const res = await GET(new Request('http://localhost/api/offer-letter-snippets'))
    expect(res.status).toBe(401)
  })

  it('returns active-only by default, all when ?all=true', async () => {
    asHR()
    await prisma.offerLetterSnippet.create({
      data: { title: '__test_active', category: 'OTHER', htmlBody: '<p>a</p>', isActive: true },
    })
    await prisma.offerLetterSnippet.create({
      data: { title: '__test_inactive', category: 'OTHER', htmlBody: '<p>b</p>', isActive: false },
    })

    const res1 = await GET(new Request('http://localhost/api/offer-letter-snippets'))
    const j1 = await res1.json()
    expect(j1.snippets.find((s: { title: string }) => s.title === '__test_active')).toBeTruthy()
    expect(j1.snippets.find((s: { title: string }) => s.title === '__test_inactive')).toBeFalsy()

    const res2 = await GET(new Request('http://localhost/api/offer-letter-snippets?all=true'))
    const j2 = await res2.json()
    expect(j2.snippets.find((s: { title: string }) => s.title === '__test_inactive')).toBeTruthy()
  })
})

describe('POST /api/offer-letter-snippets', () => {
  it('returns 401 for non-HR', async () => {
    asEmployee()
    const res = await POST(new Request('http://localhost/api/offer-letter-snippets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '__test_x', category: 'OTHER', htmlBody: '<p>a</p>' }),
    }))
    expect(res.status).toBe(401)
  })

  it('creates a snippet with sanitized HTML', async () => {
    asHR()
    const res = await POST(new Request('http://localhost/api/offer-letter-snippets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '__test_create',
        category: 'OTHER',
        htmlBody: '<p>Hi</p><script>alert(1)</script>',
      }),
    }))
    expect(res.status).toBe(201)
    const j = await res.json()
    expect(j.snippet.htmlBody).not.toContain('<script>')
    expect(j.snippet.htmlBody).toContain('<p>Hi</p>')
  })

  it('rejects empty htmlBody after sanitization', async () => {
    asHR()
    const res = await POST(new Request('http://localhost/api/offer-letter-snippets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '__test_empty',
        category: 'OTHER',
        htmlBody: '<script>alert(1)</script>',
      }),
    }))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run — should fail (no routes exist yet)**

Run: `npx vitest run src/app/api/offer-letter-snippets/__tests__/route.test.ts`
Expected: FAIL with import error.

- [ ] **Step 3: Implement the route**

Create `src/app/api/offer-letter-snippets/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sanitizeOfferHtml } from '@/lib/services/offer-letter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await auth()
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const all = searchParams.get('all') === 'true'

  const snippets = await prisma.offerLetterSnippet.findMany({
    where: all ? {} : { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
  })
  return NextResponse.json({ snippets })
}

export async function POST(req: Request) {
  const session = await auth()
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body.title !== 'string' || typeof body.htmlBody !== 'string') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const cleanHtml = sanitizeOfferHtml(body.htmlBody).trim()
  if (cleanHtml.length === 0) {
    return NextResponse.json(
      { error: 'htmlBody must contain at least one paragraph after sanitization' },
      { status: 400 }
    )
  }

  const snippet = await prisma.offerLetterSnippet.create({
    data: {
      title: body.title.trim(),
      category: body.category ?? 'OTHER',
      htmlBody: cleanHtml,
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? 0,
      // @ts-expect-error - id on session.user
      createdById: session.user.id,
      // @ts-expect-error - id on session.user
      updatedById: session.user.id,
    },
  })

  return NextResponse.json({ snippet }, { status: 201 })
}
```

- [ ] **Step 4: Run — should pass**

Run: `npx vitest run src/app/api/offer-letter-snippets/__tests__/route.test.ts`
Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/offer-letter-snippets/route.ts src/app/api/offer-letter-snippets/__tests__/route.test.ts
git commit -m "feat(offer-letter): add snippet GET/POST API with auth + sanitization"
```

---

### Task 7: Snippet API — `PATCH` + `DELETE`

**Files:**
- Create: `src/app/api/offer-letter-snippets/[id]/route.ts`
- Modify: `src/app/api/offer-letter-snippets/__tests__/route.test.ts`

- [ ] **Step 1: Append failing tests**

Append to the existing test file:

```ts
import { PATCH, DELETE } from '@/app/api/offer-letter-snippets/[id]/route'

describe('PATCH /api/offer-letter-snippets/[id]', () => {
  it('returns 401 for non-HR', async () => {
    asEmployee()
    const res = await PATCH(
      new Request('http://localhost/api/offer-letter-snippets/x', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'new' }),
      }),
      { params: Promise.resolve({ id: 'x' }) }
    )
    expect(res.status).toBe(401)
  })

  it('updates fields and re-sanitizes htmlBody', async () => {
    asHR()
    const created = await prisma.offerLetterSnippet.create({
      data: { title: '__test_patch', category: 'OTHER', htmlBody: '<p>old</p>', isActive: true },
    })
    const res = await PATCH(
      new Request(`http://localhost/api/offer-letter-snippets/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlBody: '<p>new</p><script>x</script>' }),
      }),
      { params: Promise.resolve({ id: created.id }) }
    )
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.snippet.htmlBody).toContain('<p>new</p>')
    expect(j.snippet.htmlBody).not.toContain('<script>')
  })

  it('returns 404 for nonexistent id', async () => {
    asHR()
    const res = await PATCH(
      new Request('http://localhost/api/offer-letter-snippets/no-such', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'x' }),
      }),
      { params: Promise.resolve({ id: 'no-such-id' }) }
    )
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/offer-letter-snippets/[id]', () => {
  it('returns 401 for non-HR', async () => {
    asEmployee()
    const res = await DELETE(
      new Request('http://localhost/api/offer-letter-snippets/x', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'x' }) }
    )
    expect(res.status).toBe(401)
  })

  it('hard-deletes the row', async () => {
    asHR()
    const created = await prisma.offerLetterSnippet.create({
      data: { title: '__test_delete', category: 'OTHER', htmlBody: '<p>x</p>', isActive: true },
    })
    const res = await DELETE(
      new Request(`http://localhost/api/offer-letter-snippets/${created.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: created.id }) }
    )
    expect(res.status).toBe(204)
    const after = await prisma.offerLetterSnippet.findUnique({ where: { id: created.id } })
    expect(after).toBeNull()
  })
})
```

- [ ] **Step 2: Run — should fail (no `[id]` route)**

Run: `npx vitest run src/app/api/offer-letter-snippets/__tests__/route.test.ts`
Expected: FAIL with import error.

- [ ] **Step 3: Implement**

Create `src/app/api/offer-letter-snippets/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sanitizeOfferHtml } from '@/lib/services/offer-letter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const existing = await prisma.offerLetterSnippet.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Snippet not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (typeof body.title === 'string') data.title = body.title.trim()
  if (typeof body.category === 'string') data.category = body.category
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive
  if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder
  if (typeof body.htmlBody === 'string') {
    const cleaned = sanitizeOfferHtml(body.htmlBody).trim()
    if (cleaned.length === 0) {
      return NextResponse.json(
        { error: 'htmlBody must contain at least one paragraph after sanitization' },
        { status: 400 }
      )
    }
    data.htmlBody = cleaned
  }
  // @ts-expect-error - id on session.user
  data.updatedById = session.user.id

  const snippet = await prisma.offerLetterSnippet.update({ where: { id }, data })
  return NextResponse.json({ snippet })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  await prisma.offerLetterSnippet.delete({ where: { id } }).catch(() => null)
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 4: Run — should pass**

Run: `npx vitest run src/app/api/offer-letter-snippets/__tests__/route.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/offer-letter-snippets/[id]/route.ts src/app/api/offer-letter-snippets/__tests__/route.test.ts
git commit -m "feat(offer-letter): add snippet PATCH/DELETE API"
```

---

### Task 8: Seed snippets script

**Files:**
- Create: `prisma/seed-offer-snippets.ts`
- Modify: `package.json`

- [ ] **Step 1: Create the seed file**

Create `prisma/seed-offer-snippets.ts`:

```ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface Seed {
  title: string
  category:
    | 'WORKING_HOURS'
    | 'PROBATION'
    | 'LEAVE'
    | 'NOTICE'
    | 'DOCUMENTS'
    | 'CONFIDENTIALITY'
    | 'OTHER'
  sortOrder: number
  htmlBody: string
}

const SEEDS: Seed[] = [
  {
    title: 'Working Hours & Location',
    category: 'WORKING_HOURS',
    sortOrder: 10,
    htmlBody: `<section class="clause"><div class="clause-head"><span class="num-mark">03</span><span class="title-en">Working Hours &amp; Location</span><span class="title-hi hi">कार्य समय एवं स्थान</span></div><ul><li>Place of work: <strong>Thepla House, [Branch] branch</strong>, Mumbai. The Company reserves the right to transfer you to any of its other branches in Mumbai with reasonable notice.</li><li>Working hours: <strong>09:30 to 18:30 hrs</strong>, with one 30-minute meal break and one 15-minute tea break.</li><li>Weekly off: <strong>One day per week</strong>, on rotation, as decided by the Branch Manager.</li><li>You may be required to work additional hours during festivals, special events or business exigencies; overtime shall be compensated as per Company policy.</li></ul></section>`,
  },
  {
    title: 'Probation — 3 months',
    category: 'PROBATION',
    sortOrder: 20,
    htmlBody: `<section class="clause"><div class="clause-head"><span class="num-mark">04</span><span class="title-en">Probation Period</span><span class="title-hi hi">परिवीक्षा अवधि</span></div><p class="body">You shall be on probation for a period of <strong>three (3) months</strong> from the date of joining. During this period, your services may be terminated by either party by giving <strong>seven (7) days' written notice</strong>, without assigning any reason. On satisfactory completion of probation, your appointment shall be confirmed in writing.</p></section>`,
  },
  {
    title: 'Leave Policy — Standard',
    category: 'LEAVE',
    sortOrder: 30,
    htmlBody: `<section class="clause"><div class="clause-head"><span class="num-mark">05</span><span class="title-en">Leave Policy</span><span class="title-hi hi">अवकाश नीति</span></div><ul><li><strong>Earned Leave:</strong> 12 days per calendar year, accruing at 1 day per month worked. Encashment as per Company policy.</li><li><strong>Casual / Sick Leave:</strong> 7 days per calendar year. Sick leave beyond 2 consecutive days requires a medical certificate.</li><li><strong>Public Holidays:</strong> Per the Company's published list of 8 holidays for the calendar year.</li><li><strong>Overtime:</strong> Hours worked beyond the prescribed shift, on prior approval of the Branch Manager, shall be compensated at <strong>1.5× the per-hour rate</strong>.</li><li>Leave during the probation period is permitted only on prior written approval and is generally not encouraged.</li></ul></section>`,
  },
  {
    title: 'Notice Period — 30 days',
    category: 'NOTICE',
    sortOrder: 40,
    htmlBody: `<section class="clause"><div class="clause-head"><span class="num-mark">06</span><span class="title-en">Notice Period &amp; Termination</span><span class="title-hi hi">नोटिस अवधि एवं समाप्ति</span></div><p class="body">Post confirmation, either party may terminate this employment by giving <strong>thirty (30) days' written notice</strong>, or one month's gross salary in lieu thereof. Notwithstanding the above, the Company reserves the right to terminate your services without notice in cases of misconduct, dishonesty, breach of confidentiality, unauthorised absence exceeding three consecutive working days, or conduct prejudicial to the interests of the Company.</p></section>`,
  },
  {
    title: 'Documents Required at Joining',
    category: 'DOCUMENTS',
    sortOrder: 50,
    htmlBody: `<section class="clause"><div class="clause-head"><span class="num-mark">07</span><span class="title-en">Documents Required at Joining</span><span class="title-hi hi">कार्यभार के समय आवश्यक दस्तावेज़</span></div><ul><li>Self-attested copy of Aadhaar Card and PAN Card</li><li>Passport-size photographs (2 nos.)</li><li>Bank account details (cancelled cheque or passbook front page)</li><li>Proof of last drawn salary, if previously employed</li><li>Address proof (utility bill / rent agreement)</li></ul></section>`,
  },
]

async function main() {
  // title is not @unique in the schema (we allow duplicate titles for HR
  // flexibility), so we cannot use prisma.upsert. Manual find-or-update.
  for (const seed of SEEDS) {
    const existing = await prisma.offerLetterSnippet.findFirst({
      where: { title: seed.title },
    })
    if (existing) {
      await prisma.offerLetterSnippet.update({
        where: { id: existing.id },
        data: {
          category: seed.category,
          sortOrder: seed.sortOrder,
          htmlBody: seed.htmlBody,
          isActive: true,
        },
      })
    } else {
      await prisma.offerLetterSnippet.create({ data: seed })
    }
  }
  console.log(`Seeded ${SEEDS.length} offer letter snippets.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

- [ ] **Step 2: Add the npm script**

Modify `package.json` — add to `scripts`:

```json
"db:seed:offer-snippets": "tsx prisma/seed-offer-snippets.ts"
```

(If `tsx` is not in `devDependencies`, install it: `npm install -D tsx`. If `ts-node` is the project convention, swap to `ts-node prisma/seed-offer-snippets.ts` instead.)

- [ ] **Step 3: Run the seed**

Run: `npm run db:seed:offer-snippets`
Expected: `Seeded 5 offer letter snippets.`

- [ ] **Step 4: Run again — confirm idempotency**

Run: `npm run db:seed:offer-snippets`
Expected: Same output, no duplicates. Verify in Prisma Studio there are exactly 5 rows.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed-offer-snippets.ts package.json package-lock.json
git commit -m "feat(offer-letter): seed 5 default bilingual snippets"
```

---

### Task 9: Wire `termsHtml` into the JobOffer API

**Files:**
- Modify: `src/app/api/job-offers/route.ts`
- Modify: `src/app/api/job-offers/[id]/route.ts`
- Create: `src/app/api/job-offers/__tests__/terms-html.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/job-offers/__tests__/terms-html.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest'
import { POST } from '@/app/api/job-offers/route'
import { PUT } from '@/app/api/job-offers/[id]/route'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

vi.mock('@/auth', () => ({ auth: vi.fn() }))

afterEach(async () => {
  await prisma.jobOffer.deleteMany({ where: { name: { startsWith: '__test_' } } })
  await prisma.user.deleteMany({ where: { email: { contains: '@offer.test' } } })
  vi.resetAllMocks()
})

function asHR() {
  ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'hr-1', role: 'HR' },
  })
}

async function makeUser() {
  return prisma.user.create({
    data: {
      name: '__test_user',
      email: `offer-${Date.now()}@offer.test`,
      role: 'JOB_OFFER',
      status: 'JOB_OFFER',
    },
  })
}

describe('POST /api/job-offers — termsHtml', () => {
  it('strips <script> from termsHtml on save', async () => {
    asHR()
    const u = await makeUser()
    const res = await POST(new Request('http://localhost/api/job-offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '__test_offer',
        userId: u.id,
        name: '__test_offer',
        designation: 'Cashier',
        role: 'EMPLOYEE',
        totalSalary: 240000,
        salaryComponents: [{ name: 'Gross', perAnnum: 240000, perMonth: 20000 }],
        deductions: [],
        joiningDate: '2026-06-01',
        termsHtml: '<p>Hi</p><script>alert(1)</script>',
      }),
    }))
    expect(res.status).toBe(200)
    const created = await prisma.jobOffer.findFirst({ where: { name: '__test_offer' } })
    expect(created?.termsHtml).toBeTruthy()
    expect(created?.termsHtml).not.toContain('<script>')
    expect(created?.termsHtml).toContain('<p>Hi</p>')
  })
})
```

(Note: the actual route signature for POST/PUT might vary; this test uses the existing signatures from `src/app/api/job-offers/route.ts` and `src/app/api/job-offers/[id]/route.ts`. If the route accepts different fields, adjust the body accordingly — read the existing route code to confirm.)

- [ ] **Step 2: Run — should fail**

Run: `npx vitest run src/app/api/job-offers/__tests__/terms-html.test.ts`
Expected: FAIL — termsHtml not yet wired into the route.

- [ ] **Step 3: Modify the POST route**

Edit `src/app/api/job-offers/route.ts`. Find the destructuring near line 92–94 (which currently extracts `halfDays, weekOff, notes`). Add `termsHtml` to the destructure and import the sanitizer at top of file:

```ts
import { sanitizeOfferHtml } from '@/lib/services/offer-letter'
```

In the destructure, add `termsHtml`:

```ts
const { /* existing fields */, halfDays, weekOff, notes, termsHtml } = body
```

When building the `data` object passed to `prisma.jobOffer.create`, add (alongside `notes: notes || null`):

```ts
termsHtml: typeof termsHtml === 'string' ? sanitizeOfferHtml(termsHtml) : null,
```

- [ ] **Step 4: Modify the PUT route**

Edit `src/app/api/job-offers/[id]/route.ts`. Same pattern: import sanitizer, destructure `termsHtml`, in the update payload add:

```ts
termsHtml: typeof termsHtml === 'string' ? sanitizeOfferHtml(termsHtml) : undefined,
```

- [ ] **Step 5: Run tests — should pass**

Run: `npx vitest run src/app/api/job-offers/__tests__/terms-html.test.ts`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/job-offers/route.ts src/app/api/job-offers/[id]/route.ts src/app/api/job-offers/__tests__/terms-html.test.ts
git commit -m "feat(offer-letter): accept and sanitize termsHtml on JobOffer save"
```

---

### Task 10: Form — add Terms & Policies section, remove halfDays/weekOff

**Files:**
- Modify: `src/components/job-offers/job-offer-form.tsx`
- Create: `src/components/job-offers/snippet-panel.tsx`

- [ ] **Step 1: Create the SnippetPanel**

Create `src/components/job-offers/snippet-panel.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'

interface Snippet {
  id: string
  title: string
  category: string
  htmlBody: string
  sortOrder: number
}

const CATEGORY_LABELS: Record<string, string> = {
  WORKING_HOURS: 'Working Hours',
  PROBATION: 'Probation',
  LEAVE: 'Leave',
  NOTICE: 'Notice',
  DOCUMENTS: 'Documents',
  CONFIDENTIALITY: 'Confidentiality',
  OTHER: 'Other',
}

export function SnippetPanel() {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/offer-letter-snippets')
      .then((r) => r.json())
      .then((data) => setSnippets(data.snippets ?? []))
      .catch(() => setSnippets([]))
      .finally(() => setLoading(false))
  }, [])

  function copyHtml(html: string) {
    navigator.clipboard.writeText(html)
      .then(() => toast.success('Copied — paste into the editor.'))
      .catch(() => toast.error('Copy failed'))
  }

  const grouped = snippets.reduce<Record<string, Snippet[]>>((acc, s) => {
    (acc[s.category] ||= []).push(s)
    return acc
  }, {})

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Snippet Library</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {loading && <div className="text-muted-foreground">Loading…</div>}
        {!loading && snippets.length === 0 && (
          <div className="text-muted-foreground">No snippets available.</div>
        )}
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat}>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              {CATEGORY_LABELS[cat] ?? cat}
            </div>
            <ul className="space-y-1">
              {list.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span className="truncate" title={s.title}>{s.title}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => copyHtml(s.htmlBody)}
                    aria-label={`Copy ${s.title}`}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="pt-2 border-t">
          <a href="/admin/offer-letter-snippets" className="text-xs underline text-muted-foreground">
            Manage snippets →
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Edit the form schema**

In `src/components/job-offers/job-offer-form.tsx`, add `termsHtml` to `jobOfferFormSchema` (after the existing `notes` field):

```ts
termsHtml: z.string().min(1, 'Terms & Policies cannot be empty').default(''),
```

Remove `halfDays` and `weekOff` from the schema (lines 59–60 of the current file).

- [ ] **Step 3: Update the form's defaultValues**

In `useForm`'s `defaultValues`, replace the `halfDays`/`weekOff` defaults with:

```ts
termsHtml: jobOffer?.termsHtml ?? '',
```

(Remove the `halfDays: jobOffer?.halfDays ?? 4` and `weekOff: jobOffer?.weekOff ?? 2` lines.)

- [ ] **Step 4: Remove the halfDays/weekOff form fields**

In the JSX (around lines 659/681 of the current file), delete the two `<FormField>` blocks for `halfDays` and `weekOff`. Their parent grid wrapper can stay if it holds other inputs; otherwise remove it too.

- [ ] **Step 5: Add the Terms & Policies section**

In the JSX, after the Benefits section card and before the Notes card, insert:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Terms &amp; Policies</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground mb-4">
      Compose Clauses 03+ here. Click "Copy" on a snippet, then paste into the editor.
    </p>
    <div className="grid gap-4 md:grid-cols-[1fr_280px]">
      <FormField
        control={form.control}
        name="termsHtml"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <RichTextEditor value={field.value} onChange={field.onChange} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <SnippetPanel />
    </div>
  </CardContent>
</Card>
```

Add the imports near the top:

```tsx
import dynamic from 'next/dynamic'
const RichTextEditor = dynamic(
  () => import('@/components/rich-text-editor/rich-text-editor'),
  { ssr: false }
)
import { SnippetPanel } from './snippet-panel'
```

- [ ] **Step 6: Update the submit handler**

In the form's `onSubmit`, ensure `termsHtml` is part of the body sent to the API. If the existing handler uses `data` from `form.handleSubmit`, it should already include it via the schema. If the handler manually constructs the payload, add `termsHtml: data.termsHtml`.

Also remove any `halfDays: data.halfDays` and `weekOff: data.weekOff` lines from the payload construction.

- [ ] **Step 7: Run typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. If TS complains about `RichTextEditor` import, confirm the file at `src/components/rich-text-editor/rich-text-editor.tsx` exists (it does — used by notes).

- [ ] **Step 8: Smoke test in dev**

Run: `npm run dev`
Sign in as HR, navigate to `/job-offers/new`, scroll to "Terms & Policies", verify the rich-text editor and snippet panel render side-by-side. Click Copy on a seeded snippet → expect a toast.

- [ ] **Step 9: Commit**

```bash
git add src/components/job-offers/job-offer-form.tsx src/components/job-offers/snippet-panel.tsx
git commit -m "feat(offer-letter): add Terms & Policies form section with snippet panel"
```

---

### Task 11: Print page CSS

**Files:**
- Create: `src/app/(print)/job-offers/[id]/offer-letter.css`

- [ ] **Step 1: Source the reference CSS**

The user provided a print-ready reference HTML during brainstorming. Ask the user for the file (e.g., `Offer Letter-print.html`) and place it under `/tmp/`. The full inline `<style>` block (~700 lines) needs to be copied verbatim into `src/app/(print)/job-offers/[id]/offer-letter.css` with the `<style>` / `</style>` wrappers stripped.

Required CSS structure (top-level rules and selectors):

- `@page { size: A4 portrait; margin: 0 }` and `@media print { ... }` rules.
- `:root` custom properties: `--cream`, `--cream-deep`, `--green`, `--green-deep`, `--green-soft`, `--gold`, `--gold-soft`, `--coral`, `--ink-1..4`, `--rule`, `--rule-strong`, plus `--font-body` (Inter), `--font-display` (Epilogue), `--font-hindi` (Noto Sans Devanagari).
- Page shell: `.page` (210mm × 297mm, cream background, padding `18mm 18mm 16mm`); `.page::before` (the 2px gold left-margin stripe).
- Letterhead block: `.letterhead`, `.letterhead .logo`, `.letterhead .name`, `.letterhead .tagline`, `.letterhead .addr`, `.letterhead .addr .links`.
- `.ref-row`, `.ref-row .k`, `.ref-row .v`.
- `.doc-title`, `.doc-title .en`, `.doc-title .hi`, `.doc-title .underline`.
- `.to-block`, `.to-lbl`, `.to-block .name`.
- `.salutation`, `.salutation .hi`.
- `.subject`.
- `p.body`, `p.body strong`.
- `.clause`, `.clause-head`, `.clause-head .num-mark`, `.clause-head .title-en`, `.clause-head .title-hi`, `.clause p.body`, `.clause ul`, `.clause ul li`, `.clause ul li::before`.
- `.comp-table`, `.comp-table th`, `.comp-table td`, `.comp-table td.amt`, `.comp-table tr.total`, `.comp-table tr.total td`, `.comp-table tr.total td.amt`.
- `.sign-block`, `.sign-block .col`, `.sign-block .col .role`, `.sign-block .col .line`, `.sign-block .col .nm`, `.sign-block .col .desig`, `.sign-block .col .stamp` (and its children), `.sign-block .col .stamp-col`.
- `.accept`, `.accept .head`, `.accept p`, `.accept .row`, `.accept .field`, `.accept .field .lbl`, `.accept .field .line`.
- `.page-foot`, `.page-foot .right`.
- `.annex-title`, `.annex-title .eyebrow`, `.annex-title .en`, `.annex-title .hi`, `.annex-title .ul`.
- `.ctc-summary`, `.ctc-summary .tile`, `.ctc-summary .tile .k`, `.ctc-summary .tile .v`, `.ctc-summary .tile.featured`.
- `.ctc-table`, `.ctc-table thead th`, `.ctc-table thead th.amt-col`, `.ctc-table tbody td`, `.ctc-table tbody td .hint`, `.ctc-table tbody td.amt`, `.ctc-table tbody tr.section-head td`, `.ctc-table tbody tr.subtotal td`, `.ctc-table tbody tr.grand td`.
- `.annex-note`.
- Utility classes: `.num` (tabular numerals), `.hi` (Hindi font + weight).

Add a `<link>` for the Google Fonts in `src/app/(print)/layout.tsx` (or a `<style>` import). Inter, Epilogue, Noto Sans Devanagari weights are needed:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Epilogue:wght@600;700;800;900&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" rel="stylesheet">
```

Add this `<link>` block as a Next 15 `<head>` element via `import { Inter } from 'next/font/google'` (Next-native) **or** by injecting `<link>` tags directly in the `(print)` layout. Choose the approach that matches existing patterns in the project (check how `payslip.css` references its fonts — if there's no font wiring there, prefer the `<link>` approach since it matches the reference HTML).

- [ ] **Step 2: Verify CSS validity**

Run: `npx postcss src/app/\(print\)/job-offers/\[id\]/offer-letter.css --no-map -o /dev/null` (if postcss is installed)
Or simply check Next.js build output in the next task. Skip this step if postcss isn't available.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(print\)/job-offers/\[id\]/offer-letter.css
git commit -m "feat(offer-letter): port reference design CSS to print stylesheet"
```

---

### Task 12: Print page React component (Page 1 — letter body)

**Files:**
- Create: `src/app/(print)/job-offers/[id]/page.tsx`
- Create: `src/components/job-offers/print-button.tsx`

- [ ] **Step 1: Create a local PrintButton**

Create `src/components/job-offers/print-button.tsx`:

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <Button onClick={() => window.print()} className="gap-2">
      <Printer className="h-4 w-4" />
      Download PDF
    </Button>
  )
}
```

- [ ] **Step 2: Create the print page (Page 1 only first)**

Create `src/app/(print)/job-offers/[id]/page.tsx`:

```tsx
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { PrintButton } from '@/components/job-offers/print-button'
import {
  buildReferenceNo,
  formatLetterDate,
  sanitizeOfferHtml,
  computeAnnexureSummary,
  type SalaryComponent,
} from '@/lib/services/offer-letter'
import './offer-letter.css'

interface PageProps {
  params: Promise<{ id: string }>
}

const titlePrefix = (gender?: string | null): string => {
  if (!gender) return ''
  const g = gender.toUpperCase()
  if (g === 'MALE' || g === 'M') return 'Mr.'
  if (g === 'FEMALE' || g === 'F') return 'Ms.'
  return ''
}

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)

export default async function OfferLetterPrintPage({ params }: PageProps) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  // @ts-expect-error - role is not in the User type
  const role = session.user.role as string
  if (!['HR', 'MANAGEMENT'].includes(role)) redirect('/dashboard')

  const { id } = await params
  const jobOffer = await prisma.jobOffer.findUnique({
    where: { id },
    include: {
      user: { include: { branch: true } },
      department: true,
    },
  })
  if (!jobOffer) notFound()

  const refNo = buildReferenceNo(jobOffer.numId, jobOffer.offerDate)
  const dateStr = formatLetterDate(jobOffer.offerDate)
  const salutation = `${titlePrefix(jobOffer.user?.gender)} ${jobOffer.name}`.trim()
  const branchName = jobOffer.user?.branch?.name ?? jobOffer.department?.name ?? 'the assigned location'
  const joining = jobOffer.joiningDate
    ? formatLetterDate(jobOffer.joiningDate)
    : 'the date communicated separately'

  const sanitizedTerms = sanitizeOfferHtml(jobOffer.termsHtml ?? '')

  const components = (jobOffer.salaryComponents as SalaryComponent[] | null) ?? []
  const grossPerMonth = components.length > 0
    ? components.reduce((s, c) => s + c.perMonth, 0)
    : Math.round(jobOffer.totalSalary / 12)

  return (
    <>
      <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 9999 }}>
        <PrintButton />
      </div>

      {/* PAGE 1 — Letter body */}
      <div className="page">
        <header className="letterhead">
          <div className="logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/company/logo.png" alt="Thepla House" />
          </div>
          <div className="name">Thepla House</div>
          <div className="tagline">By Tejal&apos;s Kitchen</div>
          <div className="addr">
            Gala No. 6, Shriguppi Industrial Estate, Sakivihar Road, Andheri (E), Mumbai &mdash; 400072
            <span className="links">
              <span>+91 98195 55065</span>
              <span>info@theplahouse.com</span>
              <span>www.theplahouse.com</span>
            </span>
          </div>
        </header>

        <div className="ref-row">
          <div><span className="k">Ref. No.</span><span className="v num">{refNo}</span></div>
          <div><span className="k">Date</span><span className="v">{dateStr}</span></div>
        </div>

        <div className="doc-title">
          <div className="en">Offer of Employment</div>
          <div className="hi">नियुक्ति का प्रस्ताव पत्र</div>
          <span className="underline"></span>
        </div>

        <div className="to-block">
          <div className="to-lbl">To / सेवा में</div>
          <div className="name">{salutation}</div>
        </div>

        <div className="salutation">Dear {salutation}, <span className="hi">/ आदरणीय,</span></div>
        <div className="subject">Subject: Offer of Employment as {jobOffer.designation} — {branchName}</div>

        <p className="body">
          With reference to your application and the subsequent interview, we are pleased to offer you the position of{' '}
          <strong>{jobOffer.designation}</strong> at our <strong>{branchName}</strong> branch of Thepla House
          (a unit of Tejal&apos;s Kitchen Pvt. Ltd.), on the terms and conditions set out below.
        </p>
        <p className="body">
          Your appointment shall be effective from <strong>{joining}</strong> and is subject to your acceptance of this
          offer and submission of the documents listed in the Documents clause on or before your date of joining.
        </p>

        {/* Clause 01 — Position & Date of Joining */}
        <section className="clause">
          <div className="clause-head">
            <span className="num-mark">01</span>
            <span className="title-en">Position &amp; Date of Joining</span>
            <span className="title-hi hi">पद एवं कार्यभार की तिथि</span>
          </div>
          <p className="body">
            You are appointed as <strong>{jobOffer.designation}</strong> at the <strong>{branchName}</strong> branch.
            Your date of joining shall be <strong>{joining}</strong>. Failure to join on or before this date — without
            prior written intimation — shall render this offer null and void.
          </p>
        </section>

        {/* Clause 02 — Compensation */}
        <section className="clause">
          <div className="clause-head">
            <span className="num-mark">02</span>
            <span className="title-en">Compensation</span>
            <span className="title-hi hi">वेतन एवं भत्ते</span>
          </div>
          <p className="body">
            Your gross monthly salary shall be <strong>₹{formatINR(grossPerMonth)}/-</strong>, payable on or before the
            7th of every succeeding month, by direct credit to your bank account. The breakdown is as follows:
          </p>
          <table className="comp-table">
            <thead>
              <tr><th>Component</th><th style={{ textAlign: 'right' }}>Monthly (₹)</th></tr>
            </thead>
            <tbody>
              {components.map((c, i) => (
                <tr key={i}><td>{c.name}</td><td className="amt num">{formatINR(c.perMonth)}</td></tr>
              ))}
              {components.length === 0 && (
                <tr><td>Gross Monthly Salary</td><td className="amt num">{formatINR(grossPerMonth)}</td></tr>
              )}
              {components.length > 0 && (
                <tr className="total">
                  <td>Gross Monthly Salary</td>
                  <td className="amt num">{formatINR(grossPerMonth)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="body" style={{ marginTop: 10 }}>
            Statutory deductions — Professional Tax, Provident Fund (where applicable) and Employee State Insurance —
            shall be made in accordance with the laws of Maharashtra. A detailed CTC structure is attached as{' '}
            <strong>Annexure A</strong>.
          </p>
        </section>

        {/* HR-authored clauses 03+ */}
        <div
          className="terms"
          dangerouslySetInnerHTML={{
            __html: sanitizedTerms || '<aside class="muted">No additional terms specified.</aside>',
          }}
        />

        <div className="page-foot">
          <span>Offer Letter · {jobOffer.name} · Ref. {refNo}</span>
          <span className="right">Page 1</span>
        </div>
      </div>

      {/* Pages 2 and Annexure — added in next tasks */}
    </>
  )
}
```

- [ ] **Step 3: Smoke test**

Run: `npm run dev`
Visit `http://localhost:3000/job-offers/<some-existing-offer-id>` (the print page lives at this path because the `(print)` route group is unprefixed). Wait — verify by looking at how payslips work:

The payslip route is `(print)/users/[id]/payslips/[salaryId]/page.tsx` and is reached via `/users/[id]/payslips/[salaryId]`. That conflicts with the (auth) route group's `users/[id]` — but Next handles route group precedence by file presence. For our case, `(print)/job-offers/[id]/page.tsx` will collide with `(auth)/job-offers/[id]/edit/page.tsx`'s parent — let's verify by trying.

If conflict occurs, move the print route to `(print)/job-offers/[id]/print/page.tsx` and access via `/job-offers/[id]/print`. Update Task 13 accordingly.

Expected: page renders with Page 1 layout, letterhead, all clauses, gold left stripe visible, no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(print\)/job-offers/\[id\]/page.tsx src/components/job-offers/print-button.tsx
git commit -m "feat(offer-letter): render print page Page 1 (letterhead + clauses 01-02 + termsHtml)"
```

---

### Task 13: Print page — Page 2 (closing + signature + acceptance)

**Files:**
- Modify: `src/app/(print)/job-offers/[id]/page.tsx`

- [ ] **Step 1: Add Page 2 to the JSX**

In `src/app/(print)/job-offers/[id]/page.tsx`, after the closing `</div>` of Page 1's `.page` (and before the `</> ` fragment close), insert:

```tsx
{/* PAGE 2 — Closing + signature + acceptance */}
<div className="page">
  <header className="letterhead" style={{ paddingBottom: 12, marginBottom: 18 }}>
    <div className="name" style={{ fontSize: 16 }}>Thepla House</div>
    <div className="tagline" style={{ marginTop: 2, fontSize: 9.5 }}>
      Offer Letter — continued · Ref. {refNo}
    </div>
  </header>

  <p className="body" style={{ marginTop: 22 }}>
    We look forward to welcoming you to the Thepla House family and trust that your association with us will be
    long, productive and mutually rewarding. Please sign and return the duplicate copy of this letter in token of
    your acceptance of the above terms.
  </p>

  <p className="body" style={{ marginTop: 4 }}>
    Yours sincerely,
    <span className="hi" style={{ color: 'var(--ink-3)', fontSize: 11, marginLeft: 6 }}>
      / भवदीय,
    </span>
  </p>

  <div className="sign-block">
    <div className="col">
      <div className="role">For Thepla House</div>
      <div className="line"></div>
      <div className="nm">Tejal Mehta</div>
      <div className="desig">
        Director, Tejal&apos;s Kitchen Pvt. Ltd.
        <span className="hi">निदेशक</span>
      </div>
    </div>
    <div className="col stamp-col">
      <div className="stamp" aria-hidden="true">
        <span className="star">★</span>
        <span className="top">THEPLA HOUSE</span>
        <span className="mid">MUMBAI</span>
        <span className="bot">EST. 2018</span>
        <span className="star">★</span>
      </div>
    </div>
  </div>

  <section className="accept">
    <div className="head">
      Acceptance of Offer
      <span className="hi">/ प्रस्ताव की स्वीकृति</span>
    </div>
    <p>
      I, <strong>{salutation}</strong>, have read and understood the terms and conditions set out in this letter
      and the attached Annexure A, and I hereby accept the offer of employment with Thepla House on the terms
      stated above.
    </p>
    <div className="row">
      <div className="field">
        <span className="lbl">Signature of Candidate</span>
        <div className="line"></div>
      </div>
      <div className="field">
        <span className="lbl">Date</span>
        <div className="line"></div>
      </div>
    </div>
  </section>

  <div className="page-foot">
    <span>Offer Letter · {jobOffer.name} · Ref. {refNo}</span>
    <span className="right">Page 2</span>
  </div>
</div>
```

- [ ] **Step 2: Smoke test**

Reload the print page in dev. Expected: second page visible below first; signature block, stamp graphic, acceptance block all render.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(print\)/job-offers/\[id\]/page.tsx
git commit -m "feat(offer-letter): render print page Page 2 (closing + signature + acceptance)"
```

---

### Task 14: Print page — Annexure A

**Files:**
- Modify: `src/app/(print)/job-offers/[id]/page.tsx`

- [ ] **Step 1: Compute the annexure summary**

In the same file, just after `const sanitizedTerms = ...`, add:

```tsx
const deductions = (jobOffer.deductions as SalaryComponent[] | null) ?? []
const annexure = computeAnnexureSummary({
  salaryComponents: components.length > 0 ? components : null,
  deductions: deductions.length > 0 ? deductions : null,
  totalSalary: jobOffer.totalSalary,
})
```

- [ ] **Step 2: Add Annexure A page after Page 2**

After Page 2's closing `</div>` and before the fragment close, insert:

```tsx
{/* ANNEXURE A — Detailed CTC */}
<div className="page">
  <header className="letterhead" style={{ paddingBottom: 12, marginBottom: 22 }}>
    <div className="name" style={{ fontSize: 16 }}>Thepla House</div>
    <div className="tagline" style={{ marginTop: 2, fontSize: 9.5 }}>
      Annexure A · Ref. {refNo}
    </div>
  </header>

  <div className="annex-title">
    <div className="eyebrow">Annexure A</div>
    <div className="en">Detailed CTC Structure</div>
    <div className="hi">वेतन संरचना का विवरण</div>
    <div className="ul"></div>
  </div>

  <div className="ctc-summary">
    <div className="tile">
      <div className="k">Gross / Month</div>
      <div className="v num">₹{formatINR(annexure.grossPerMonth)}</div>
    </div>
    <div className="tile featured">
      <div className="k">Total CTC / Annum</div>
      <div className="v num">₹{formatINR(annexure.totalCtcPerAnnum)}</div>
    </div>
    <div className="tile">
      <div className="k">Take-home / Month</div>
      <div className="v num">₹{formatINR(annexure.takeHomePerMonth)}</div>
    </div>
  </div>

  <table className="ctc-table">
    <thead>
      <tr>
        <th style={{ width: '46%' }}>Component</th>
        <th className="amt-col" style={{ width: '18%' }}>Monthly (₹)</th>
        <th className="amt-col" style={{ width: '18%' }}>Annual (₹)</th>
        <th style={{ width: '18%' }}>Notes</th>
      </tr>
    </thead>
    <tbody>
      <tr className="section-head"><td colSpan={4}>A. Fixed Earnings · निश्चित वेतन</td></tr>
      {components.map((c, i) => (
        <tr key={i}>
          <td>{c.name}</td>
          <td className="amt num">{formatINR(c.perMonth)}</td>
          <td className="amt num">{formatINR(c.perAnnum)}</td>
          <td>Monthly</td>
        </tr>
      ))}
      <tr className="subtotal">
        <td>Subtotal — Gross Monthly Salary</td>
        <td className="amt num">{formatINR(annexure.grossPerMonth)}</td>
        <td className="amt num">{formatINR(annexure.grossPerMonth * 12)}</td>
        <td>—</td>
      </tr>

      {deductions.length > 0 && (
        <>
          <tr className="section-head"><td colSpan={4}>C. Statutory Deductions · वैधानिक कटौती</td></tr>
          {deductions.map((d, i) => (
            <tr key={`d${i}`}>
              <td>{d.name}</td>
              <td className="amt num">{formatINR(d.perMonth)}</td>
              <td className="amt num">{formatINR(d.perAnnum)}</td>
              <td>Monthly</td>
            </tr>
          ))}
          <tr className="subtotal">
            <td>Estimated Take-home / Month</td>
            <td className="amt num">{formatINR(annexure.takeHomePerMonth)}</td>
            <td className="amt num">{formatINR(annexure.takeHomePerMonth * 12)}</td>
            <td>Indicative</td>
          </tr>
        </>
      )}

      <tr className="grand">
        <td>Total Cost to Company (CTC)</td>
        <td className="amt num">—</td>
        <td className="amt num">₹{formatINR(annexure.totalCtcPerAnnum)}</td>
        <td>Per annum</td>
      </tr>
    </tbody>
  </table>

  <div className="annex-note">
    <strong>Notes:</strong> &nbsp;
    (i) The above structure is indicative and may be revised annually based on Company policy and statutory norms.
    (ii) PF deductions apply once you complete EPFO on-boarding, generally from the second month of joining.
    (iii) Bonus is payable in accordance with the Payment of Bonus Act, 1965, subject to statutory thresholds.
    (iv) Income Tax shall be deducted at source, if applicable.
  </div>

  <div className="page-foot">
    <span>Annexure A · CTC Structure · {jobOffer.name}</span>
    <span className="right">Page A1</span>
  </div>
</div>
```

- [ ] **Step 3: Smoke test**

Reload the print page. Verify:
- Annexure A page renders below Page 2.
- Three summary tiles show correct values.
- CTC table lists each salary component and deduction.
- `Ctrl+P` → Save as PDF — confirm A4 layout, gold stripes on all 3 pages, footers on all pages.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(print\)/job-offers/\[id\]/page.tsx
git commit -m "feat(offer-letter): render Annexure A with CTC summary tiles and detailed table"
```

---

### Task 15: Add "Open Letter (New Design)" action

**Files:**
- Modify: `src/components/job-offers/job-offer-actions.tsx`

- [ ] **Step 1: Add the new action**

In `src/components/job-offers/job-offer-actions.tsx`, after the existing `handleDownloadOfferLetter` function (around line 51), add:

```tsx
const handleOpenNewLetter = () => {
  // Adjust the path if Task 12 placed the print route under /print/...
  window.open(`/job-offers/${jobOffer.id}`, '_blank')
}
```

(If Task 12 had to use `/job-offers/[id]/print` due to a route group collision, change the URL accordingly.)

In the JSX (around line 115 — the existing "Download Offer Letter" item), wrap the existing item and add a new one above it:

```tsx
<DropdownMenuItem onClick={handleOpenNewLetter}>
  <FileText className="mr-2 h-4 w-4" />
  Open Letter (New Design)
</DropdownMenuItem>
<DropdownMenuItem onClick={handleDownloadOfferLetter}>
  <FileText className="mr-2 h-4 w-4" />
  Download Offer Letter (PDF)
</DropdownMenuItem>
```

(Renamed "Download Offer Letter" → "Download Offer Letter (PDF)" to make the distinction clear to HR.)

- [ ] **Step 2: Smoke test**

Run dev. From the job-offers list, open the actions menu for any offer. Expected: two items now visible — "Open Letter (New Design)" and "Download Offer Letter (PDF)". Click each, verify both renderers work side-by-side.

- [ ] **Step 3: Commit**

```bash
git add src/components/job-offers/job-offer-actions.tsx
git commit -m "feat(offer-letter): expose both renderers in actions menu"
```

---

### Task 16: Snippet admin — list page

**Files:**
- Create: `src/app/(auth)/admin/offer-letter-snippets/page.tsx`
- Create: `src/components/admin/offer-letter-snippets/snippet-list.tsx`

- [ ] **Step 1: Create the list component**

Create `src/components/admin/offer-letter-snippets/snippet-list.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Snippet {
  id: string
  title: string
  category: string
  htmlBody: string
  isActive: boolean
  sortOrder: number
  updatedAt: string
}

export function SnippetList() {
  const router = useRouter()
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/offer-letter-snippets?all=true')
    const j = await res.json()
    setSnippets(j.snippets ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function toggleActive(s: Snippet) {
    const res = await fetch(`/api/offer-letter-snippets/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !s.isActive }),
    })
    if (!res.ok) {
      toast.error('Failed to update')
      return
    }
    void load()
  }

  async function doDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/offer-letter-snippets/${deleteId}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Failed to delete')
      return
    }
    toast.success('Snippet deleted')
    setDeleteId(null)
    void load()
  }

  if (loading) return <div>Loading…</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Offer Letter Snippets</h1>
        <Button onClick={() => router.push('/admin/offer-letter-snippets/new')}>
          <Plus className="h-4 w-4 mr-1" /> New Snippet
        </Button>
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-2">Title</th>
            <th>Category</th>
            <th>Sort</th>
            <th>Active</th>
            <th>Updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {snippets.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="py-2 font-medium">{s.title}</td>
              <td className="text-muted-foreground">{s.category}</td>
              <td>{s.sortOrder}</td>
              <td><Switch checked={s.isActive} onCheckedChange={() => toggleActive(s)} /></td>
              <td className="text-muted-foreground">{new Date(s.updatedAt).toLocaleDateString()}</td>
              <td className="flex gap-1 py-2">
                <Button variant="ghost" size="icon"
                  onClick={() => router.push(`/admin/offer-letter-snippets/${s.id}/edit`)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </td>
            </tr>
          ))}
          {snippets.length === 0 && (
            <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No snippets yet.</td></tr>
          )}
        </tbody>
      </table>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this snippet?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Existing offer letters that already pasted this snippet are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **Step 2: Create the page**

Create `src/app/(auth)/admin/offer-letter-snippets/page.tsx`:

```tsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { SnippetList } from '@/components/admin/offer-letter-snippets/snippet-list'

export default async function OfferLetterSnippetsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  // @ts-expect-error - role is not in the User type
  if (!['HR', 'MANAGEMENT'].includes(session.user.role)) redirect('/dashboard')

  return (
    <div className="p-8">
      <SnippetList />
    </div>
  )
}
```

- [ ] **Step 3: Smoke test**

Run dev. As HR, visit `/admin/offer-letter-snippets`. Expected: list of the 5 seeded snippets, each with title, category, sort order, active toggle. Toggle one off, verify it disappears from the offer-form snippet panel (`/job-offers/new`).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(auth\)/admin/offer-letter-snippets/page.tsx src/components/admin/offer-letter-snippets/snippet-list.tsx
git commit -m "feat(offer-letter): admin list page for snippet library"
```

---

### Task 17: Snippet admin — create / edit pages

**Files:**
- Create: `src/app/(auth)/admin/offer-letter-snippets/new/page.tsx`
- Create: `src/app/(auth)/admin/offer-letter-snippets/[id]/edit/page.tsx`
- Create: `src/components/admin/offer-letter-snippets/snippet-form.tsx`

- [ ] **Step 1: Create the form component**

Create `src/components/admin/offer-letter-snippets/snippet-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

const RichTextEditor = dynamic(
  () => import('@/components/rich-text-editor/rich-text-editor'),
  { ssr: false }
)

interface SnippetFormProps {
  snippet?: {
    id: string
    title: string
    category: string
    htmlBody: string
    isActive: boolean
    sortOrder: number
  }
}

const CATEGORIES = ['WORKING_HOURS', 'PROBATION', 'LEAVE', 'NOTICE', 'DOCUMENTS', 'CONFIDENTIALITY', 'OTHER']

export function SnippetForm({ snippet }: SnippetFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState(snippet?.title ?? '')
  const [category, setCategory] = useState(snippet?.category ?? 'OTHER')
  const [htmlBody, setHtmlBody] = useState(snippet?.htmlBody ?? '')
  const [isActive, setIsActive] = useState(snippet?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(snippet?.sortOrder ?? 0)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    setSaving(true)
    try {
      const url = snippet
        ? `/api/offer-letter-snippets/${snippet.id}`
        : '/api/offer-letter-snippets'
      const method = snippet ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, htmlBody, isActive, sortOrder }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? 'Save failed')
      }
      toast.success('Snippet saved')
      router.push('/admin/offer-letter-snippets')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Sort order</Label>
          <Input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value || '0', 10))}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <Label>Active</Label>
        </div>
        <div>
          <Label>HTML body</Label>
          <RichTextEditor value={htmlBody} onChange={setHtmlBody} />
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </div>

      <div>
        <Label>Preview</Label>
        <div
          className="border rounded p-4 mt-1 bg-[hsl(39_100%_97%)] text-sm"
          dangerouslySetInnerHTML={{ __html: htmlBody }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the new page**

Create `src/app/(auth)/admin/offer-letter-snippets/new/page.tsx`:

```tsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { SnippetForm } from '@/components/admin/offer-letter-snippets/snippet-form'

export default async function NewSnippetPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  // @ts-expect-error - role is not in the User type
  if (!['HR', 'MANAGEMENT'].includes(session.user.role)) redirect('/dashboard')

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">New Offer Letter Snippet</h1>
      <SnippetForm />
    </div>
  )
}
```

- [ ] **Step 3: Create the edit page**

Create `src/app/(auth)/admin/offer-letter-snippets/[id]/edit/page.tsx`:

```tsx
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { SnippetForm } from '@/components/admin/offer-letter-snippets/snippet-form'

interface PageProps { params: Promise<{ id: string }> }

export default async function EditSnippetPage({ params }: PageProps) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  // @ts-expect-error - role is not in the User type
  if (!['HR', 'MANAGEMENT'].includes(session.user.role)) redirect('/dashboard')

  const { id } = await params
  const snippet = await prisma.offerLetterSnippet.findUnique({ where: { id } })
  if (!snippet) notFound()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Edit Offer Letter Snippet</h1>
      <SnippetForm snippet={{
        id: snippet.id,
        title: snippet.title,
        category: snippet.category,
        htmlBody: snippet.htmlBody,
        isActive: snippet.isActive,
        sortOrder: snippet.sortOrder,
      }} />
    </div>
  )
}
```

- [ ] **Step 4: Smoke test**

Run dev. Visit `/admin/offer-letter-snippets`, click "New Snippet". Fill in title, category, paste some HTML, save. Verify it appears in the list. Edit it. Verify changes persist.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/admin/offer-letter-snippets/new/page.tsx src/app/\(auth\)/admin/offer-letter-snippets/\[id\]/edit/page.tsx src/components/admin/offer-letter-snippets/snippet-form.tsx
git commit -m "feat(offer-letter): admin create/edit pages for snippet library"
```

---

### Task 18: Full test + typecheck + lint sweep

- [ ] **Step 1: Run full test suite**

Run: `npm run test`
Expected: all tests pass (existing + ~25 new ones from Tasks 3, 4, 5, 6, 7, 9).

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint src/lib/services/offer-letter.ts src/app/api/offer-letter-snippets src/app/api/job-offers src/app/\(print\)/job-offers src/components/job-offers src/components/admin/offer-letter-snippets`
Expected: no errors.

- [ ] **Step 4: Manual UAT walkthrough**

In dev:

1. Create a new offer with all 5 snippets pasted into the editor → save → click "Open Letter (New Design)" → verify all 3 pages render correctly. `Ctrl+P` → Save as PDF → confirm A4 layout, gold left stripe, footers visible on every page.
2. Take an **existing PENDING offer** (post-backfill) → click "Open Letter (New Design)" → confirm Clause 03 contains the legacy bilingual sentence. Click "Download Offer Letter (PDF)" → confirm the old pdf-lib renderer still works.
3. Snippet admin: create a new snippet, edit it, deactivate it (verify it disappears from the offer-form panel), reactivate it, delete it.
4. Form: try saving a new offer with empty `termsHtml` → confirm validation prevents submit. Try with only `<script>` content → confirm 400 from API.

- [ ] **Step 5: Commit any final fixes**

If UAT revealed issues, commit individual fixes:

```bash
git add ...
git commit -m "fix(offer-letter): <specific fix>"
```

---

### Task 19: Push branch and open PR

- [ ] **Step 1: Push**

```bash
git push -u origin feature/job-offer-letter-redesign
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(offer-letter): bilingual print-styled letter + Terms editor + snippet library" --body "$(cat <<'EOF'
## Summary
- New bilingual (EN+HI) print-styled offer letter rendered the payslip way (server React + window.print) at `/job-offers/[id]` (in the `(print)` route group).
- Replaces the hardcoded "Two week offs / Four half days" sentence with a per-offer rich-text Terms & Policies field on `JobOffer`.
- New `OfferLetterSnippet` table + admin UI at `/admin/offer-letter-snippets` for HR-managed bilingual clauses.
- Backfill migration populates `termsHtml` for existing offers using legacy `halfDays`/`weekOff` so they re-print without regression.
- **Existing pdf-lib renderer is preserved** as a fallback. Actions menu now exposes both "Open Letter (New Design)" and "Download Offer Letter (PDF)".

Spec: `docs/superpowers/specs/2026-05-07-job-offer-letter-redesign-design.md`
Plan: `docs/superpowers/plans/2026-05-07-job-offer-letter-redesign.md`

## Test plan
- [x] Unit: sanitize, refNo, dateFmt, annexure summary
- [x] Integration: snippet CRUD, JobOffer termsHtml round-trip
- [ ] Manual UAT: new design renders for old + new offers, both action items work, snippet admin CRUD works
- [ ] Confirm dev → staging → prod migration applies cleanly

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Verify**

Run: `gh pr view --web` (opens in browser)

---

## Self-Review

**1. Spec coverage:**

- Drop pdf-lib (Goal 1): ❌ Spec explicitly says **keep** pdf-lib as fallback this PR. Task 15 wires both renderers into the actions menu. ✅
- Bilingual brand-styled design (Goal 2): Tasks 11–14 (CSS port + Pages 1, 2, Annexure A). ✅
- Replace hardcoded sentence with `termsHtml` (Goal 3): Task 2 (schema + backfill), Task 9 (API), Task 10 (form). ✅
- Snippet library (Goal 4): Tasks 6–8 (API + seed), 16–17 (admin UI), 10 (form panel). ✅
- Backfill (Goal 5): Task 2 (SQL appended to migration). ✅
- Keep pdf-lib (Goal 6): explicitly preserved by Task 15; no Delete step in any task. ✅

Schema (Section 2): Task 2 covers `termsHtml`, `OfferLetterSnippet`, enum, inverse relations on `User`, backfill SQL. ✅

Print page rendering (Section 3): Tasks 11 (CSS), 12 (Page 1 + clauses 01–02 + termsHtml), 13 (Page 2 + signature + acceptance), 14 (Annexure A). ✅

Snippet library (Section 4): Tasks 6 (GET/POST), 7 (PATCH/DELETE), 8 (seed), 16 (list), 17 (form). ✅

Form/UX (Section 5): Task 10 covers schema additions, layout, removal of `halfDays`/`weekOff`, snippet panel, Notes textarea kept. ✅

Edge cases (Section 6 of spec): null `salaryComponents` handled in Task 12 (fallback to single row). Null `deductions` handled in Task 14 (omit C-section if empty). Null `joiningDate` handled in Task 12 (`'the date communicated separately'`). Null `User.gender` handled in Task 12 (`titlePrefix` returns ''). ✅

**2. Placeholder scan:** No "TBD", "TODO", "implement later", or vague "add error handling" steps. Every code step shows the code. Tasks 11 and 17 reference the live reference HTML/snippet content explicitly.

**3. Type consistency:**
- `SalaryComponent { name; perAnnum; perMonth }` defined in Task 5, used in Tasks 12 and 14.
- `AnnexureSummary { grossPerMonth; totalCtcPerAnnum; takeHomePerMonth }` defined in Task 5, used in Task 14.
- `sanitizeOfferHtml(input: string): string` signature consistent across Tasks 3, 6, 7, 9, 12.
- `buildReferenceNo`, `formatLetterDate` used identically in Task 12.
- `OfferLetterSnippetCategory` enum values match between schema (Task 2) and seed (Task 8) and form (Task 17).

**4. Known caveats called out for the engineer:**
- The print route path may collide with `(auth)/job-offers/[id]/edit` — Task 12 step 3 explicitly tells the engineer how to fall back to `/job-offers/[id]/print` if needed, and Task 15 cross-references the resolution.
- The seed file uses a manual upsert because `title` is not `@unique` — documented in Task 8.
- The API route signatures in Task 9 reference the existing route's destructure pattern; the engineer is told to read the existing route to confirm field names.

The plan ships in 19 commits, fully testable, with the existing pdf-lib renderer preserved for HR validation.
