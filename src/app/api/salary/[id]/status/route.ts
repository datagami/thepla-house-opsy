import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from "@/auth"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    // @ts-expect-error - role is not in the User type
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { status } = await request.json()
    const {id} = await params;

    const allowedStatuses = ['PENDING', 'PROCESSING', 'PAID', 'FAILED'] as const
    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const updatedSalary = await prisma.salary.update({
      where: { id: id },
      data: {
        status,
        paidAt: status === 'PAID' ? new Date() : null,
      },
    })

    return NextResponse.json(updatedSalary)
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: 'Failed to update salary status' },
      { status: 500 }
    )
  }
} 
