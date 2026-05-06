import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  // @ts-expect-error - role is not in the User type
  if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      numId: true,
      name: true,
      salary: true,
      optInPT: true,
      optInPF: true,
      optInESI: true,
    },
    orderBy: { numId: 'asc' },
  })

  return NextResponse.json(users)
}
