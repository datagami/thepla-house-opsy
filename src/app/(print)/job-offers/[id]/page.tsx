import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { PrintButton } from '@/components/job-offers/print-button'
import {
  buildReferenceNo,
  formatLetterDate,
  sanitizeOfferHtml,
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

      {/* Annexure — added in next task */}
    </>
  )
}
