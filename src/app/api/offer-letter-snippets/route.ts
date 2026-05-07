import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sanitizeOfferHtml } from '@/lib/services/offer-letter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await auth()
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const all = searchParams.get('all') === 'true'

  const snippets = await prisma.offerLetterSnippet.findMany({
    where: all ? {} : { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
  })
  return NextResponse.json({ snippets })
}

export async function POST(req: Request) {
  const session = await auth()
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body.title !== 'string' || typeof body.htmlBody !== 'string') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const cleanHtml = sanitizeOfferHtml(body.htmlBody).trim()
  if (cleanHtml.length === 0) {
    return NextResponse.json(
      { error: 'htmlBody must contain at least one paragraph after sanitization' },
      { status: 400 }
    )
  }

  const snippet = await prisma.offerLetterSnippet.create({
    data: {
      title: body.title.trim(),
      category: body.category ?? 'OTHER',
      htmlBody: cleanHtml,
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? 0,
      // @ts-expect-error - id on session.user
      createdById: session.user.id,
      // @ts-expect-error - id on session.user
      updatedById: session.user.id,
    },
  })

  return NextResponse.json({ snippet }, { status: 201 })
}
