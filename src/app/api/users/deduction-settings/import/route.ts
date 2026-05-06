import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

interface ImportRow {
  uid: string
  optInPT: boolean
  optInPF: boolean
  optInESI: boolean
}

interface ValidationError {
  rowIndex: number
  uid: string
  error: string
}

function parseFlag(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const v = value.trim().toUpperCase()
    if (v === 'Y' || v === 'YES' || v === 'TRUE' || v === '1') return true
    if (v === 'N' || v === 'NO' || v === 'FALSE' || v === '0' || v === '') return false
  }
  return null
}

export async function POST(req: Request) {
  const session = await auth()
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = await req.json() as { rows: Array<Record<string, unknown>> }
  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: 'Invalid payload: rows[] required' }, { status: 400 })
  }

  // Validate every row first; reject the batch on any error
  const errors: ValidationError[] = []
  const parsed: ImportRow[] = []

  // Look up valid UIDs once
  const uids = body.rows.map(r => String(r.UID ?? r.uid ?? '')).filter(Boolean)
  const existing = await prisma.user.findMany({
    where: { id: { in: uids } },
    select: { id: true },
  })
  const validUidSet = new Set(existing.map(u => u.id))

  body.rows.forEach((row, i) => {
    const uid = String(row.UID ?? row.uid ?? '').trim()
    if (!uid) {
      errors.push({ rowIndex: i, uid: '', error: 'Missing UID' })
      return
    }
    if (!validUidSet.has(uid)) {
      errors.push({ rowIndex: i, uid, error: 'UID not found' })
      return
    }
    const pt = parseFlag(row['PT*'] ?? row.PT ?? row.optInPT)
    const pf = parseFlag(row['PF*'] ?? row.PF ?? row.optInPF)
    const esi = parseFlag(row['ESI*'] ?? row.ESI ?? row.optInESI)
    if (pt === null) {
      errors.push({ rowIndex: i, uid, error: 'PT must be Y/N or TRUE/FALSE' })
      return
    }
    if (pf === null) {
      errors.push({ rowIndex: i, uid, error: 'PF must be Y/N or TRUE/FALSE' })
      return
    }
    if (esi === null) {
      errors.push({ rowIndex: i, uid, error: 'ESI must be Y/N or TRUE/FALSE' })
      return
    }
    parsed.push({ uid, optInPT: pt, optInPF: pf, optInESI: esi })
  })

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 400 })
  }

  // Commit all updates in a single transaction
  await prisma.$transaction(
    parsed.map(p =>
      prisma.user.update({
        where: { id: p.uid },
        data: {
          optInPT: p.optInPT,
          optInPF: p.optInPF,
          optInESI: p.optInESI,
        },
      }),
    ),
  )

  return NextResponse.json({ ok: true, updated: parsed.length })
}
