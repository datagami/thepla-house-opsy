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
    title: 'Probation — 3 months',
    category: 'PROBATION',
    sortOrder: 20,
    htmlBody: `<section class="clause"><h3><span class="num-mark">05</span>Probation Period</h3><p>You shall be on probation for a period of <strong>three (3) months</strong> from the date of joining. During this period, your services may be terminated by either party by giving <strong>seven (7) days' written notice</strong>, without assigning any reason. On satisfactory completion of probation, your appointment shall be confirmed in writing.</p></section>`,
  },
  {
    title: 'Leave Policy — Standard',
    category: 'LEAVE',
    sortOrder: 30,
    htmlBody: `<section class="clause"><h3><span class="num-mark">06</span>Leave Policy</h3><ul><li><strong>Earned Leave:</strong> 12 days per calendar year, accruing at 1 day per month worked. Encashment as per Company policy.</li><li><strong>Casual / Sick Leave:</strong> 7 days per calendar year. Sick leave beyond 2 consecutive days requires a medical certificate.</li><li><strong>Public Holidays:</strong> Per the Company's published list of 8 holidays for the calendar year.</li><li><strong>Overtime:</strong> Hours worked beyond the prescribed shift, on prior approval of the Branch Manager, shall be compensated at <strong>1.5× the per-hour rate</strong>.</li><li>Leave during the probation period is permitted only on prior written approval and is generally not encouraged.</li></ul></section>`,
  },
  {
    title: 'Notice Period — 30 days',
    category: 'NOTICE',
    sortOrder: 40,
    htmlBody: `<section class="clause"><h3><span class="num-mark">07</span>Notice Period &amp; Termination</h3><p>Post confirmation, either party may terminate this employment by giving <strong>thirty (30) days' written notice</strong>, or one month's gross salary in lieu thereof. Notwithstanding the above, the Company reserves the right to terminate your services without notice in cases of misconduct, dishonesty, breach of confidentiality, unauthorised absence exceeding three consecutive working days, or conduct prejudicial to the interests of the Company.</p></section>`,
  },
  {
    title: 'Documents Required at Joining',
    category: 'DOCUMENTS',
    sortOrder: 50,
    htmlBody: `<section class="clause"><h3><span class="num-mark">08</span>Documents Required at Joining</h3><ul><li>Self-attested copy of Aadhaar Card and PAN Card</li><li>Passport-size photographs (2 nos.)</li><li>Bank account details (cancelled cheque or passbook front page)</li><li>Proof of last drawn salary, if previously employed</li><li>Address proof (utility bill / rent agreement)</li></ul></section>`,
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
