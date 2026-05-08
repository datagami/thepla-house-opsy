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
    htmlBody: `<section class="clause"><h3><span class="num-mark">03</span>Working Hours &amp; Location</h3><ul><li>Place of work: <strong>Thepla House Office, 309, Crescent Business Square, Khairani Rd, Saki Naka, Mumbai, Maharashtra 400072</strong>. The Company reserves the right to transfer you to any of its other branches in Mumbai with reasonable notice.</li><li>Working hours: <strong>09:30 to 18:30 hrs</strong>, with one 30-minute meal break and one 15-minute tea break.</li></ul></section>`,
  },
  {
    title: 'Weekly Off',
    category: 'WORKING_HOURS',
    sortOrder: 15,
    htmlBody: `<section class="clause"><h3><span class="num-mark">04</span>Weekly Off</h3><ul><li><strong>Sunday</strong> will be the fixed weekly off.</li><li><strong>Saturday</strong> will be a half-day work-from-home working day.</li><li>You may be required to work additional hours during festivals, special events or business exigencies; overtime shall be compensated as per Company policy.</li></ul></section>`,
  },
  {
    title: 'Probation Period',
    category: 'PROBATION',
    sortOrder: 20,
    htmlBody: `<section class="clause"><h3><span class="num-mark">05</span>Probation Period</h3><p>You shall be on probation for a period of <strong>six (6) months</strong> from the date of joining. During this period, your services may be terminated by either party by giving <strong>five (5) days' written notice</strong>, without assigning any reason. On satisfactory completion of probation, your appointment shall be confirmed in writing.</p></section>`,
  },
  {
    title: 'Leave Policy — Standard',
    category: 'LEAVE',
    sortOrder: 30,
    htmlBody: `<section class="clause"><h3><span class="num-mark">06</span>Leave Policy</h3><ul><li><strong>Earned Leave:</strong> 18 days per calendar year, accruing at 1.5 days per month worked. No encashment; 5 leaves can be carry-forwarded to the next year.</li><li><strong>Casual / Sick Leave:</strong> Sick leave beyond 2 consecutive days requires a medical certificate.</li><li><strong>Public Holidays:</strong> Per the Company's published list of holidays for the calendar year.</li></ul></section>`,
  },
  {
    title: 'Notice Period & Termination',
    category: 'NOTICE',
    sortOrder: 40,
    htmlBody: `<section class="clause"><h3><span class="num-mark">07</span>Notice Period &amp; Termination</h3><ul><li><strong>During probation (company side):</strong> 5 days' written notice or 5 days' salary in lieu.</li><li><strong>After probation (company side):</strong> 30 days' notice or 30 days' salary in lieu.</li><li><strong>Employee side (at all times including probation):</strong> 30 days' written notice; failure results in 30 days' salary deduction.</li><li>Company may terminate <strong>immediately without notice</strong> for: breach of agreement, disobedience, misconduct, fraud/dishonesty, violation of business conduct policy, habitual neglect, conduct bringing disrepute, or any other ground permitted by law.</li><li>Company may also suspend without pay in these cases.</li></ul><p>You will be given your letter of Appointment enumerating terms and conditions within the same or a few days of joining.</p></section>`,
  },
  {
    title: 'Documents Required at Joining',
    category: 'DOCUMENTS',
    sortOrder: 50,
    htmlBody: `<section class="clause"><h3><span class="num-mark">08</span>Documents Required at Joining</h3><ul><li>Self-attested copy of Aadhaar Card and PAN Card</li><li>Passport-size photographs (2 nos.)</li><li>Bank account details (cancelled cheque or passbook front page)</li><li>Proof of last drawn salary, if previously employed</li><li>Address proof (utility bill / rent agreement)</li></ul></section>`,
  },
  {
    title: 'Income Tax',
    category: 'OTHER',
    sortOrder: 60,
    htmlBody: `<section class="clause"><h3><span class="num-mark">09</span>Income Tax</h3><p>You will be solely responsible for payment of your income tax. The Company will deduct Income Tax based on the documents submitted by you from your monthly compensation and remit such monies to the tax authorities on your behalf.</p></section>`,
  },
]

// Legacy titles to delete on re-seed. These were renamed in this revision so
// the seed's find-or-update (matched on title) won't update them — they'd be
// orphaned. Snippets are NOT FK-linked from JobOffer (terms are copied into
// JobOffer.termsHtml at use), so deleting old rows is safe.
const LEGACY_TITLES_TO_DELETE = [
  'Probation — 3 months',
  'Notice Period — 30 days',
]

async function main() {
  // Cleanup: drop legacy titles that have been renamed in SEEDS.
  const currentTitles = new Set(SEEDS.map((s) => s.title))
  for (const oldTitle of LEGACY_TITLES_TO_DELETE) {
    if (currentTitles.has(oldTitle)) continue // safety: don't delete a title still in use
    const { count } = await prisma.offerLetterSnippet.deleteMany({
      where: { title: oldTitle },
    })
    if (count > 0) {
      console.log(`Removed ${count} legacy snippet(s) titled "${oldTitle}".`)
    }
  }

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
