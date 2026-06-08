import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { format, differenceInCalendarDays } from 'date-fns'
import { PrintButton } from '@/components/job-offers/print-button'
import './leave-form.css'

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

const buildReferenceNo = (numId: number, createdAt: Date): string => {
  const yy = String(createdAt.getFullYear()).slice(-2)
  const mm = String(createdAt.getMonth() + 1).padStart(2, '0')
  return `LR/${yy}${mm}/${String(numId).padStart(4, '0')}`
}

const formatLetterDate = (d: Date): string => format(d, 'd MMMM yyyy')

export default async function LeaveApplicationPrintPage({ params }: PageProps) {
  const session = await auth()
  const sessionUser = session?.user as
    | { id?: string; role?: string; branchId?: string | null }
    | undefined
  const sessionUserId = sessionUser?.id
  const role = sessionUser?.role ?? ''
  const managerBranchId = sessionUser?.branchId ?? null

  if (!sessionUserId) redirect('/login')

  const { id } = await params
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          branch: true,
          department: true,
        },
      },
    },
  })
  if (!leaveRequest) notFound()

  // Access control:
  // - EMPLOYEE / BRANCH_MANAGER: own request only (BM may have created on
  //   behalf, but it's stored under the employee's userId, so this still
  //   resolves through the BM-branch path below).
  // - BRANCH_MANAGER: any request whose owner is in their branch.
  // - HR / MANAGEMENT: any request.
  const ownerUserId = leaveRequest.userId
  const ownerBranchId = leaveRequest.user?.branchId ?? null
  const isOwner = ownerUserId === sessionUserId
  const isPrivileged = role === 'HR' || role === 'MANAGEMENT'
  const isBranchManagerForOwner =
    role === 'BRANCH_MANAGER' && !!managerBranchId && managerBranchId === ownerBranchId
  if (!isOwner && !isPrivileged && !isBranchManagerForOwner) {
    redirect('/dashboard')
  }

  const employee = leaveRequest.user
  const salutation = `${titlePrefix(employee?.gender)} ${employee?.name ?? 'Employee'}`.trim()
  const refNo = buildReferenceNo(leaveRequest.numId, leaveRequest.createdAt)
  const filedOn = formatLetterDate(leaveRequest.createdAt)
  const startStr = formatLetterDate(leaveRequest.startDate)
  const endStr = formatLetterDate(leaveRequest.endDate)
  const days = differenceInCalendarDays(leaveRequest.endDate, leaveRequest.startDate) + 1

  return (
    <>
      <div className="print-toolbar">
        <PrintButton />
      </div>

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
          </div>
        </header>

        <div className="ref-row">
          <div><span className="k">Ref. No.</span><span className="v num">{refNo}</span></div>
          <div><span className="k">Date</span><span className="v">{filedOn}</span></div>
        </div>

        <div className="doc-title">
          <div className="en">Leave Application Form</div>
          <span className="underline"></span>
          <span className="hi">अवकाश आवेदन पत्र</span>
        </div>

        <div className="to-block">
          <div className="to-lbl">To / सेवा में</div>
          <div className="recipient">
            The Human Resources Department
            <span className="hi">मानव संसाधन विभाग</span>
          </div>
        </div>

        <div className="subject">
          Subject: Application for {leaveRequest.leaveType.charAt(0) + leaveRequest.leaveType.slice(1).toLowerCase()} Leave
          <span className="hi">
            विषय: {leaveRequest.leaveType === 'ANNUAL' ? 'वार्षिक' : leaveRequest.leaveType === 'EMERGENCY' ? 'आपातकालीन' : ''} अवकाश हेतु आवेदन
          </span>
        </div>

        <p className="body">
          Sir / Madam,
          <span className="body-hi">महोदय / महोदया,</span>
        </p>
        <p className="body">
          I am <strong>{salutation}</strong>
          {employee?.department?.name && (
            <>, working in <strong>{employee.department.name}</strong></>
          )}
          {employee?.branch?.name && (
            <> at the <strong>{employee.branch.name}</strong> branch</>
          )}
          . I am asking for <strong>{leaveRequest.leaveType}</strong> leave for{' '}
          <strong>{days}</strong> {days === 1 ? 'day' : 'days'}, from <strong>{startStr}</strong> to{' '}
          <strong>{endStr}</strong> (both days included). The reason is given below.
        </p>
        <p className="body-hi">
          मैं <strong>{salutation}</strong>
          {employee?.department?.name && (<>, <strong>{employee.department.name}</strong> में</>)}
          {employee?.branch?.name && (<> <strong>{employee.branch.name}</strong> शाखा में कार्यरत हूँ</>)}
          । मैं <strong>{days}</strong> दिन के <strong>{leaveRequest.leaveType === 'ANNUAL' ? 'वार्षिक' : 'आपातकालीन'}</strong> अवकाश हेतु प्रार्थना करता/करती हूँ, दिनांक <strong>{startStr}</strong> से <strong>{endStr}</strong> तक (दोनों दिन सम्मिलित)। कारण नीचे दिया गया है।
        </p>

        <div className="field-grid">
          <div className="field-row">
            <span className="k">Employee</span>
            <span className="v">{employee?.name ?? '—'}</span>
          </div>
          <div className="field-row">
            <span className="k">Employee ID</span>
            <span className="v num">{employee?.numId ?? '—'}</span>
          </div>
          <div className="field-row">
            <span className="k">Department</span>
            <span className="v">{employee?.department?.name ?? '—'}</span>
          </div>
          <div className="field-row">
            <span className="k">Branch</span>
            <span className="v">{employee?.branch?.name ?? '—'}</span>
          </div>
          <div className="field-row">
            <span className="k">Date of Joining</span>
            <span className="v">
              {employee?.doj ? formatLetterDate(employee.doj) : '—'}
            </span>
          </div>
          <div className="field-row">
            <span className="k">Leave Type</span>
            <span className="v">{leaveRequest.leaveType}</span>
          </div>
          <div className="field-row">
            <span className="k">From</span>
            <span className="v">{startStr}</span>
          </div>
          <div className="field-row">
            <span className="k">To</span>
            <span className="v">{endStr}</span>
          </div>
          <div className="field-row">
            <span className="k">Total Days</span>
            <span className="v num">{days}</span>
          </div>
          <div className="field-row">
            <span className="k">Filed On</span>
            <span className="v">{filedOn}</span>
          </div>
        </div>

        <div className="reason-block">
          <div className="k">Reason for Leave <span className="hi">/ अवकाश का कारण</span></div>
          <div className="reason-box">{leaveRequest.reason}</div>
        </div>

        <p className="declaration">
          I confirm that the details given above are correct. I will inform my branch manager before my leave starts and
          hand over my pending work. I will keep my phone on and answer if the office calls me during my leave.
          <span className="hi">
            मैं पुष्टि करता/करती हूँ कि ऊपर दी गई जानकारी सही है। छुट्टी पर जाने से पहले मैं अपने ब्रांच मैनेजर को सूचित करूँगा/करूँगी
            और अपना बकाया काम सौंप दूँगा/दूँगी। छुट्टी के दौरान मैं अपना फोन चालू रखूँगा/रखूँगी और ऑफिस का फोन उठाऊँगा/उठाऊँगी।
          </span>
        </p>

        <div className="undertaking">
          <div className="undertaking-head">
            Acknowledgement on Failure to Resume Duty
            <span className="hi">ड्यूटी पर समय से वापस न लौटने की स्थिति में स्वीकृति</span>
          </div>
          <p>
            Should I fail to report back to duty on or before the next working day following the expiry of the leave
            period sanctioned above, I hereby acknowledge and accept that:
            <span className="hi">
              यदि मैं स्वीकृत अवकाश की अवधि समाप्त होने के बाद अगले कार्य-दिवस तक ड्यूटी पर वापस नहीं लौटता/लौटती, तो मैं यह
              स्वीकार करता/करती हूँ कि:
            </span>
          </p>
          <ol className="undertaking-list">
            <li>
              I shall forfeit my eligibility for the annual performance appraisal cycle, together with any associated
              increments, bonuses and benefits for the relevant assessment year.
              <span className="hi">
                मैं उस वर्ष के वार्षिक मूल्यांकन (annual appraisal), वेतन-वृद्धि, बोनस तथा अन्य लाभ पाने का अधिकार खो दूँगा/दूँगी।
              </span>
            </li>
            <li>
              My employment with the Company shall stand discontinued, and any subsequent re&#8209;engagement shall
              be entirely at the Company&apos;s sole discretion, subject to availability of a suitable vacancy. Such
              re&#8209;engagement, if granted, shall be treated as <strong>fresh employment</strong>&nbsp;&mdash; with
              no continuity of service, tenure, accrued leave balance or seniority being preserved.
              <span className="hi">
                कंपनी में मेरी नौकरी समाप्त मानी जाएगी। यदि कंपनी मुझे दोबारा रखना चाहे तो यह पूरी तरह कंपनी की मर्ज़ी पर तथा
                खाली पद उपलब्ध होने पर निर्भर करेगा, और इसे <strong>नई नौकरी</strong> माना जाएगा &mdash; पुरानी सेवा-अवधि,
                सीनियरिटी या जमा छुट्टियाँ नहीं मिलेंगी।
              </span>
            </li>
            <li>
              The Company shall be entitled to withhold my final month&apos;s salary and any other dues then payable
              to me, until such time as a suitable replacement has been engaged and adequately trained to assume my
              responsibilities. No interest or compensation shall be payable by the Company in respect of the period
              of such withholding.
              <span className="hi">
                कंपनी मेरा अंतिम महीने का वेतन तथा अन्य बकाया राशि उस समय तक रोक सकती है, जब तक मेरी जगह काम के लिए नया
                व्यक्ति न मिल जाए तथा प्रशिक्षित न हो जाए। इस रोकी गई अवधि का ब्याज अथवा क्षतिपूर्ति देय नहीं होगी।
              </span>
            </li>
            <li>
              Routine or general representations &mdash; including illness without documentary support
              (<em>&ldquo;bimar ho gaya hu&rdquo;</em>), personal financial constraints
              (<em>&ldquo;paise nahi hain&rdquo;</em>), family disputes or similar reasons &mdash; shall NOT be
              regarded as valid justification for failure to resume duty within the sanctioned period. Only verified
              medical emergencies, supported by a certificate issued by a Registered Medical Practitioner, or other
              circumstances accepted at the sole discretion of the Company, shall be entertained.
              <span className="hi">
                सामान्य बहाने &mdash; जैसे प्रमाण-पत्र के बिना बीमार होना (<em>&ldquo;बीमार हो गया हूँ&rdquo;</em>), पैसों की
                कमी (<em>&ldquo;पैसे नहीं हैं&rdquo;</em>), घरेलू झगड़ा या इसी प्रकार के कारण &mdash; ड्यूटी पर समय से वापस न
                लौटने के लिए मान्य कारण <strong>नहीं माने जाएँगे</strong>। केवल पंजीकृत चिकित्सक (Registered Medical
                Practitioner) के प्रमाण-पत्र सहित चिकित्सीय आपातकाल, अथवा कंपनी द्वारा अपनी मर्ज़ी से स्वीकार की गई
                परिस्थितियाँ ही मान्य होंगी।
              </span>
            </li>
          </ol>
        </div>

        <div className="signature-block">
          <div className="col">
            <div className="role">Employee<span className="hi">कर्मचारी</span></div>
            <div className="line"></div>
            <div className="nm">{employee?.name ?? '—'}</div>
            <div className="lbl">Signature &amp; Date / हस्ताक्षर एवं दिनांक</div>
          </div>
          <div className="col">
            <div className="role">Branch Manager<span className="hi">ब्रांच मैनेजर</span></div>
            <div className="line"></div>
            <div className="lbl">Signature &amp; Date / हस्ताक्षर एवं दिनांक</div>
          </div>
          <div className="col">
            <div className="role">HR / Management<span className="hi">एच.आर. / प्रबंधन</span></div>
            <div className="line"></div>
            <div className="lbl">Signature &amp; Date / हस्ताक्षर एवं दिनांक</div>
          </div>
        </div>

        <div className="hr-use">
          <div className="head">For HR Use Only<span className="hi">/ केवल HR के उपयोग हेतु</span></div>
          <div className="row">
            <div className="field-row">
              <span className="k">Decision</span>
              <span className="v">&nbsp;</span>
            </div>
            <div className="field-row">
              <span className="k">Decision Date</span>
              <span className="v">&nbsp;</span>
            </div>
            <div className="field-row">
              <span className="k">Leave Balance Used</span>
              <span className="v">&nbsp;</span>
            </div>
            <div className="field-row">
              <span className="k">Remarks</span>
              <span className="v">&nbsp;</span>
            </div>
          </div>
        </div>

        <div className="page-foot">
          <span>Leave Application · {employee?.name ?? '—'} · Ref. {refNo}</span>
        </div>
      </div>
    </>
  )
}
