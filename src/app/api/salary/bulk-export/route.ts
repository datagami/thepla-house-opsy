import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { buildBulkWorkbook } from '@/lib/services/salary-bulk'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await auth()
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') ?? '', 10)
  const year = parseInt(searchParams.get('year') ?? '', 10)

  if (!Number.isFinite(month) || month < 1 || month > 12 ||
      !Number.isFinite(year)  || year  < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 })
  }

  const count = await prisma.salary.count({ where: { month, year } })
  if (count === 0) {
    return NextResponse.json({ error: 'No salaries exist for this month' }, { status: 400 })
  }

  const buffer = await buildBulkWorkbook(prisma, month, year)
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="salaries-${year}-${String(month).padStart(2, '0')}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
