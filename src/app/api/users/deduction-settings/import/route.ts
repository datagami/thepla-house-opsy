import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { logTargetUserActivity } from '@/lib/services/activity-log'
import { ActivityType } from '@prisma/client'

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

  // Look up valid UIDs + current flags once (current flags needed for activity log diff)
  const uids = body.rows.map(r => String(r.UID ?? r.uid ?? '')).filter(Boolean)
  const existing = await prisma.user.findMany({
    where: { id: { in: uids } },
    select: { id: true, optInPT: true, optInPF: true, optInESI: true },
  })
  const validUidSet = new Set(existing.map(u => u.id))
  const previousFlags = new Map(existing.map(u => [u.id, { optInPT: u.optInPT, optInPF: u.optInPF, optInESI: u.optInESI }]))

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

  // Activity log per user with at least one flag change (logged outside the tx to keep it short)
  // @ts-expect-error - id is not in the User type
  const actorId: string | undefined = session.user.id
  if (actorId) {
    for (const p of parsed) {
      const prev = previousFlags.get(p.uid)
      if (!prev) continue
      const changes: string[] = []
      const diff: Record<string, { from: boolean; to: boolean }> = {}
      if (prev.optInPT !== p.optInPT) {
        changes.push(`PT ${prev.optInPT ? 'ON' : 'OFF'} → ${p.optInPT ? 'ON' : 'OFF'}`)
        diff.optInPT = { from: prev.optInPT, to: p.optInPT }
      }
      if (prev.optInPF !== p.optInPF) {
        changes.push(`PF ${prev.optInPF ? 'ON' : 'OFF'} → ${p.optInPF ? 'ON' : 'OFF'}`)
        diff.optInPF = { from: prev.optInPF, to: p.optInPF }
      }
      if (prev.optInESI !== p.optInESI) {
        changes.push(`ESI ${prev.optInESI ? 'ON' : 'OFF'} → ${p.optInESI ? 'ON' : 'OFF'}`)
        diff.optInESI = { from: prev.optInESI, to: p.optInESI }
      }
      if (changes.length === 0) continue
      await logTargetUserActivity(
        ActivityType.USER_UPDATED,
        actorId,
        p.uid,
        `Statutory opt-in changed via bulk import: ${changes.join(', ')}`,
        { userId: p.uid, optInDiff: diff, source: 'bulk import' },
        req,
      )
    }
  }

  return NextResponse.json({ ok: true, updated: parsed.length })
}
