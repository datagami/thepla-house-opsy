import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sanitizeOfferHtml } from '@/lib/services/offer-letter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const existing = await prisma.offerLetterSnippet.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Snippet not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (typeof body.title === 'string') data.title = body.title.trim()
  if (typeof body.category === 'string') data.category = body.category
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive
  if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder
  if (typeof body.htmlBody === 'string') {
    const cleaned = sanitizeOfferHtml(body.htmlBody).trim()
    if (cleaned.length === 0) {
      return NextResponse.json(
        { error: 'htmlBody must contain at least one paragraph after sanitization' },
        { status: 400 }
      )
    }
    data.htmlBody = cleaned
  }
  // @ts-expect-error - id on session.user
  data.updatedById = session.user.id

  const snippet = await prisma.offerLetterSnippet.update({ where: { id }, data })
  return NextResponse.json({ snippet })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  await prisma.offerLetterSnippet.delete({ where: { id } }).catch(() => null)
  return new NextResponse(null, { status: 204 })
}
