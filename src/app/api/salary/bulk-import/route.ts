import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { applyBulkImport, parseBulkWorkbook } from '@/lib/services/salary-bulk'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await auth()
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') ?? '', 10)
  const year = parseInt(searchParams.get('year') ?? '', 10)
  if (!Number.isFinite(month) || month < 1 || month > 12 ||
      !Number.isFinite(year)  || year  < 2000 || year > 2100) {
    return NextResponse.json({ ok: false, error: 'Invalid month or year' }, { status: 400 })
  }

  const count = await prisma.salary.count({ where: { month, year } })
  if (count === 0) {
    return NextResponse.json(
      { ok: false, error: 'No salaries exist for this month' },
      { status: 400 }
    )
  }

  let buffer: Buffer
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Missing file field' }, { status: 400 })
    }
    const arr = await file.arrayBuffer()
    buffer = Buffer.from(arr)
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = await parseBulkWorkbook(buffer)
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.fileError }, { status: 400 })
  }

  const summary = await applyBulkImport({ month, year, prisma, rows: parsed.rows })
  return NextResponse.json(summary)
}
