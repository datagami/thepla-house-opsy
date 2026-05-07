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

function ordinalSuffix(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

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
  const branchName = jobOffer.user?.branch?.name ?? null
  const departmentName = jobOffer.department?.name ?? null
  const joining = jobOffer.joiningDate
    ? formatLetterDate(jobOffer.joiningDate)
    : 'the date communicated separately'

  const sanitizedTerms = sanitizeOfferHtml(jobOffer.termsHtml ?? '')

  const components = (jobOffer.salaryComponents as SalaryComponent[] | null) ?? []
  const deductions = (jobOffer.deductions as SalaryComponent[] | null) ?? []
  const annexure = computeAnnexureSummary({
    salaryComponents: components.length > 0 ? components : null,
    deductions: deductions.length > 0 ? deductions : null,
    totalSalary: jobOffer.totalSalary,
  })
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
          <span className="underline"></span>
        </div>

        <div className="to-block">
          <div className="to-lbl">To</div>
          <div className="name">{salutation}</div>
        </div>

        <div className="salutation">Dear {salutation},</div>
        <div className="subject">Subject: Letter of Offer — {jobOffer.designation}</div>

        <p className="body">
          With reference to your application and the subsequent interview, we are pleased to offer you the position of{' '}
          <strong>{jobOffer.designation}</strong>
          {departmentName && (
            <> in the <strong>{departmentName}</strong> department</>
          )}
          {branchName && (
            <> at our <strong>{branchName}</strong> branch</>
          )}
          {' '}with Thepla House (a unit of Tejal&apos;s Kitchen Pvt. Ltd.), on the terms and conditions set out below.
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
          </div>
          <p className="body">
            You are appointed to the role of <strong>{jobOffer.designation}</strong>
            {departmentName && (
              <>, in the <strong>{departmentName}</strong> department</>
            )}
            {branchName && (
              <>, based at our <strong>{branchName}</strong> branch</>
            )}
            . Your date of joining shall be <strong>{joining}</strong>. Failure to join on or before this date —
            without prior written intimation — shall render this offer null and void.
          </p>
        </section>

        {/* Clause 02 — Compensation */}
        <section className="clause">
          <div className="clause-head">
            <span className="num-mark">02</span>
            <span className="title-en">Compensation</span>
          </div>
          <p className="body">
            Your gross monthly salary shall be <strong>₹{formatINR(grossPerMonth)}/-</strong>, payable on or before the{' '}
            <strong>{ordinalSuffix(jobOffer.salaryPayDay)}</strong> of every succeeding month, by direct credit to your
            bank account. If the {ordinalSuffix(jobOffer.salaryPayDay)} falls on a bank holiday or non-working day, the
            salary will be credited on the next working day. The breakdown is as follows:
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
        </p>

        <div className="sign-block">
          <div className="col">
            <div className="role">For Thepla House</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/company/signature.png"
              alt="Authorised Signatory"
              className="signature-img"
            />
            <div className="nm">Tejal Shah</div>
            <div className="desig">
              (Authorised Signatory)
            </div>
          </div>
          <div className="col" aria-hidden="true"></div>
        </div>

        <section className="accept">
          <div className="head">
            Acceptance of Offer
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
            <tr className="section-head"><td colSpan={4}>A. Fixed Earnings</td></tr>
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
                <tr className="section-head"><td colSpan={4}>C. Statutory Deductions</td></tr>
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
    </>
  )
}
