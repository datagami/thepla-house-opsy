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
        </div>

        <div className="to-block">
          <div className="to-lbl">To</div>
          <div className="recipient">The Human Resources Department</div>
        </div>

        <div className="subject">
          Subject: Application for {leaveRequest.leaveType.charAt(0) + leaveRequest.leaveType.slice(1).toLowerCase()} Leave
        </div>

        <p className="body">
          Sir / Madam,
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
          <div className="k">Reason for Leave</div>
          <div className="reason-box">{leaveRequest.reason}</div>
        </div>

        <p className="declaration">
          I confirm that the details given above are correct. I will inform my branch manager before my leave starts and
          hand over my pending work. I will keep my phone on and answer if the office calls me during my leave.
        </p>

        <div className="signature-block">
          <div className="col">
            <div className="role">Employee</div>
            <div className="line"></div>
            <div className="nm">{employee?.name ?? '—'}</div>
            <div className="lbl">Signature &amp; Date</div>
          </div>
          <div className="col">
            <div className="role">Branch Manager</div>
            <div className="line"></div>
            <div className="lbl">Signature &amp; Date</div>
          </div>
          <div className="col">
            <div className="role">HR / Management</div>
            <div className="line"></div>
            <div className="lbl">Signature &amp; Date</div>
          </div>
        </div>

        <div className="hr-use">
          <div className="head">For HR Use Only</div>
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
