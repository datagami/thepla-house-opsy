import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { PrintButton } from '@/components/salary/print-button'
import './payslip.css'

const monthName = (m: number, y: number) =>
  new Date(y, m - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })

const formatINR = (n: number, decimals = 0) =>
  '₹' +
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)

const formatDate = (d: Date) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(d)

const titlePrefix = (gender?: string | null): string => {
  if (!gender) return ''
  const g = gender.toUpperCase()
  if (g === 'MALE' || g === 'M') return 'Mr.'
  if (g === 'FEMALE' || g === 'F') return 'Ms.'
  return ''
}

const formatDays = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(1))

export default async function PayslipPage({
  params,
}: {
  params: Promise<{ id: string; salaryId: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { id: userId, salaryId } = await params
  // @ts-expect-error - role is not in the User type
  const role = session.user.role as string
  const sessionUid = (session.user as { id?: string }).id

  const isOwn = sessionUid === userId
  if (!isOwn && !['HR', 'MANAGEMENT'].includes(role)) {
    redirect('/dashboard')
  }

  const salary = await prisma.salary.findUnique({
    where: { id: salaryId },
    include: {
      user: { include: { branch: true, department: true } },
      installments: { include: { advance: true } },
      referrals: true,
    },
  })
  if (!salary || salary.userId !== userId) notFound()

  // --- Derived values ---
  const startDate = new Date(salary.year, salary.month - 1, 1)
  const endDate = new Date(salary.year, salary.month, 0)
  const attendance = await prisma.attendance.findMany({
    where: { userId: salary.userId, date: { gte: startDate, lte: endDate }, status: 'APPROVED' },
  })

  const totalDaysInMonth = endDate.getDate()
  const perDaySalary = Math.round((salary.baseSalary / totalDaysInMonth) * 100) / 100

  const regularDays = attendance.filter(
    a => a.isPresent && !a.isHalfDay && !a.overtime && !a.isWeeklyOff && !a.isWorkFromHome
  ).length
  const halfDays = attendance.filter(a => a.isHalfDay).length
  const overtimeDays = attendance.filter(a => a.isPresent && a.overtime && !a.isWeeklyOff).length
  const weeklyOffDays = attendance.filter(a => a.isWeeklyOff && a.isPresent).length
  const wfhDays = attendance.filter(a => a.isWorkFromHome).length
  const leaveDays = attendance.filter(a => !a.isPresent).length
  const presentDays = regularDays + overtimeDays + halfDays * 0.5 + weeklyOffDays + wfhDays

  const presentDaysSalary = presentDays * perDaySalary
  const overtimeSalary = overtimeDays * 0.5 * perDaySalary

  let leavesEarned = 0
  if (!salary.user.hasWeeklyOff) {
    const presentDaysForBonusLeaves = regularDays + overtimeDays + halfDays * 0.5
    if (presentDaysForBonusLeaves >= 25) leavesEarned = 2
    else if (presentDaysForBonusLeaves >= 15) leavesEarned = 1
  }
  const leaveSalary = leavesEarned * perDaySalary
  const baseSalaryEarned =
    presentDaysSalary + overtimeSalary + (salary.otherBonuses ?? 0) + leaveSalary
  const totalEarnings = baseSalaryEarned

  const totalAdvanceDeductions = salary.installments
    .filter(i => i.status === 'APPROVED')
    .reduce((s, i) => s + i.amountPaid, 0)
  const approvedInstallments = salary.installments.filter(i => i.status === 'APPROVED')

  const recurringEntries =
    (salary.recurringDeductions as Array<{ code: string; name: string; amount: number }> | null) ??
    []
  const totalRecurring = recurringEntries.reduce((s, e) => s + e.amount, 0)
  const totalOtherDeductions = salary.otherDeductions ?? 0
  const totalDeductions = totalAdvanceDeductions + totalOtherDeductions + totalRecurring

  const calculatedNet = totalEarnings - totalDeductions
  const roundedNet = Math.round(calculatedNet)

  const totalReferralBonus = salary.referrals?.reduce((s, r) => s + (r.bonusAmount || 0), 0) ?? 0
  const otherBonuses = salary.otherBonuses ?? 0

  const period = monthName(salary.month, salary.year)
  const generatedOn = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  const u = salary.user
  const empPrefix = titlePrefix((u as { gender?: string | null }).gender)

  // Earnings rows
  const earningRows: Array<{ label: string; hint?: string; amount: number }> = [
    {
      label: 'Present Days Salary',
      hint: `${formatDays(presentDays)} × ${formatINR(perDaySalary, 2)}`,
      amount: presentDaysSalary,
    },
  ]
  if (overtimeSalary > 0) {
    earningRows.push({
      label: 'Overtime Bonus',
      hint: `${overtimeDays} × 0.5 × ${formatINR(perDaySalary, 2)}`,
      amount: overtimeSalary,
    })
  }
  if (leaveSalary > 0) {
    earningRows.push({
      label: 'Leave Salary',
      hint: `${leavesEarned} × ${formatINR(perDaySalary, 2)}`,
      amount: leaveSalary,
    })
  }
  if (totalReferralBonus > 0 && otherBonuses > totalReferralBonus) {
    earningRows.push({ label: 'Other Bonuses', amount: otherBonuses - totalReferralBonus })
    earningRows.push({ label: 'Referral Bonus', amount: totalReferralBonus })
  } else if (otherBonuses > 0) {
    earningRows.push({ label: 'Other Bonuses', amount: otherBonuses })
  }

  // Attendance tiles
  const tiles: Array<{ label: string; value: number }> = [
    { label: 'Days in Month', value: totalDaysInMonth },
    { label: 'Present', value: presentDays },
    { label: 'Regular', value: regularDays },
    { label: 'Weekly Off', value: weeklyOffDays },
    { label: 'WFH', value: wfhDays },
    { label: 'Half Day', value: halfDays },
    { label: 'Overtime', value: overtimeDays },
    { label: 'Leave', value: leaveDays },
    { label: 'Earned Leaves', value: leavesEarned },
  ]

  return (
    <div className="payslip-shell">
      <div className="payslip-toolbar">
        <PrintButton />
      </div>

      <div className="payslip-page">
        {/* Header */}
        <header className="ps-header">
          <div className="ps-brand">
            <div className="ps-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/company/logo.png" alt="Thepla House" />
            </div>
            <div>
              <div className="ps-brand-name">
                Thepla House
                <span className="ps-brand-by">By Tejal&apos;s Kitchen</span>
              </div>
            </div>
          </div>
          <div className="ps-contact">
            <div className="ps-addr">
              Gala No. 6, Shriguppi Industrial Estate,
              <br />
              Sakivihar Road, Andheri (E), Mumbai &mdash; 400072
            </div>
            <div className="ps-links">
              <span>+91 98195 55065</span>
              <span>info@theplahouse.com</span>
              <span>www.theplahouse.com</span>
            </div>
          </div>
        </header>

        {/* Title band */}
        <div className="ps-title-band">
          <div className="ps-title">Payslip</div>
          <div className="ps-period">
            <span className="ps-period-lbl">Salary Period</span>
            <span className="ps-period-val">{period}</span>
          </div>
        </div>

        {/* Employee card */}
        <section className="ps-emp-card">
          <div className="ps-emp-head">
            <div className="ps-person">
              <div>
                {empPrefix && <span className="ps-prefix">{empPrefix}</span>}
                <span className="ps-name">{u.name ?? 'N/A'}</span>
              </div>
              <div className="ps-role">
                <span className="ps-dept">{u.department?.name ?? u.title ?? 'Employee'}</span>
                <span className="ps-dot">&middot;</span>
                {u.branch?.name ?? 'N/A'} Branch
              </div>
            </div>
            <div className="ps-id-pill">
              <span className="ps-id-lbl">Employee ID</span>
              <span className="ps-id-val">#{u.numId}</span>
            </div>
          </div>
          <div className="ps-emp-grid">
            <div className="ps-field">
              <span className="ps-k">Date of Joining</span>
              <span className="ps-v">{u.doj ? formatDate(new Date(u.doj)) : 'N/A'}</span>
            </div>
            <div className="ps-field">
              <span className="ps-k">Date of Birth</span>
              <span className="ps-v">{u.dob ? formatDate(new Date(u.dob)) : 'N/A'}</span>
            </div>
            <div className="ps-field">
              <span className="ps-k">Monthly Salary</span>
              <span className="ps-v ps-num">{formatINR(salary.baseSalary, 2)}</span>
            </div>
            <div className="ps-field">
              <span className="ps-k">Per Day Rate</span>
              <span className="ps-v ps-num">{formatINR(perDaySalary, 2)}</span>
            </div>
            <div className="ps-field ps-wide">
              <span className="ps-k">Bank Account</span>
              <span className="ps-v ps-num">{u.bankAccountNo ?? 'N/A'}</span>
            </div>
            <div className="ps-field ps-wide">
              <span className="ps-k">IFSC Code</span>
              <span className="ps-v">{u.bankIfscCode ?? 'N/A'}</span>
            </div>
          </div>
        </section>

        {/* Earnings + Deductions */}
        <section className="ps-calc">
          {/* Earnings */}
          <div className="ps-panel ps-earnings">
            <div className="ps-panel-head">
              <span className="ps-h">Earnings</span>
              <span className="ps-chip ps-chip-credit">Credit</span>
            </div>
            {earningRows.map((row, idx) => (
              <div className="ps-row" key={`e-${idx}`}>
                <div className="ps-lbl-wrap">
                  <span className="ps-lbl">{row.label}</span>
                  {row.hint && <span className="ps-hint ps-num">{row.hint}</span>}
                </div>
                <span className="ps-amt ps-num">{formatINR(row.amount)}</span>
              </div>
            ))}
            <div className="ps-spacer" />
            <div className="ps-row ps-subtotal">
              <span className="ps-lbl">Total Earnings</span>
              <span className="ps-amt ps-num">{formatINR(totalEarnings)}</span>
            </div>
          </div>

          {/* Deductions */}
          <div className="ps-panel ps-deductions">
            <div className="ps-panel-head">
              <span className="ps-h">Deductions</span>
              <span className="ps-chip ps-chip-debit">Debit</span>
            </div>

            {recurringEntries.length > 0 && (
              <>
                <div className="ps-sub-head">Statutory Deductions</div>
                {recurringEntries.map(entry => (
                  <div className="ps-row" key={`r-${entry.code}`}>
                    <div className="ps-lbl-wrap">
                      <span className="ps-lbl">{entry.name}</span>
                    </div>
                    <span className="ps-amt ps-num">{formatINR(entry.amount)}</span>
                  </div>
                ))}
              </>
            )}

            {approvedInstallments.length > 0 && (
              <>
                <div className="ps-sub-head">Advance Deductions</div>
                {approvedInstallments.map(inst => (
                  <div className="ps-row" key={`i-${inst.id}`}>
                    <div className="ps-lbl-wrap">
                      <span className="ps-lbl">{inst.advance.reason || 'Advance Payment'}</span>
                    </div>
                    <span className="ps-amt ps-num">{formatINR(inst.amountPaid)}</span>
                  </div>
                ))}
              </>
            )}

            {totalOtherDeductions > 0 && (
              <div className="ps-row">
                <div className="ps-lbl-wrap">
                  <span className="ps-lbl">Other Deductions</span>
                </div>
                <span className="ps-amt ps-num">{formatINR(totalOtherDeductions)}</span>
              </div>
            )}

            {totalDeductions === 0 && <div className="ps-row ps-empty">No Deductions</div>}

            <div className="ps-spacer" />
            <div className="ps-row ps-subtotal">
              <span className="ps-lbl">Total Deductions</span>
              <span className="ps-amt ps-num">{formatINR(totalDeductions)}</span>
            </div>
          </div>
        </section>

        {/* Net Salary hero */}
        <section className="ps-net">
          <div className="ps-net-left">
            <span className="ps-net-lbl">Net Salary</span>
            <span className="ps-net-sub">
              Earnings {formatINR(totalEarnings)}
              <span className="ps-bullet"> &mdash; </span>
              Deductions {formatINR(totalDeductions)}
            </span>
          </div>
          <div className="ps-net-right">
            <div className="ps-net-amt ps-num">{formatINR(roundedNet)}</div>
            <div className="ps-net-raw ps-num">
              Calculated: {formatINR(calculatedNet, 2)} &middot; rounded to nearest rupee
            </div>
          </div>
        </section>

        {/* Attendance */}
        <section className="ps-attendance">
          <div className="ps-att-head">
            <span className="ps-h">Attendance Summary</span>
            <span className="ps-att-meta">
              {period} &middot; {totalDaysInMonth} days
            </span>
          </div>
          <div className="ps-tiles">
            {tiles.map(tile => {
              const isPrimary = tile.label === 'Days in Month' || tile.label === 'Present'
              const isZero = tile.value === 0
              return (
                <div
                  className={`ps-tile${isPrimary ? ' ps-tile-primary' : ''}${
                    isZero && !isPrimary ? ' ps-tile-zero' : ''
                  }`}
                  key={tile.label}
                >
                  <div className="ps-tile-v ps-num">{formatDays(tile.value)}</div>
                  <div className="ps-tile-k">{tile.label}</div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Footer */}
        <footer className="ps-footer">
          <span>Generated on {generatedOn} &middot; System-generated, no signature required.</span>
          <span className="ps-footer-brand">THEPLA HOUSE &middot; PAYROLL</span>
        </footer>
      </div>
    </div>
  )
}
