import {prisma} from '@/lib/prisma'
import {NextResponse} from 'next/server'
import {auth} from "@/auth"

export async function GET(
  request: Request,
  {params}: { params: Promise<{ id: string; advanceId: string }> }
) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return NextResponse.json(
        {error: 'Unauthorized'},
        {status: 401}
      )
    }

    const {id, advanceId} = await params

    console.log(id, advanceId);

    const installments = await prisma.advancePaymentInstallment.findMany({
      where: {
        userId: id,
        advanceId
      },
      include: {
        salary: {
          select: {
            month: true,
            year: true
          }
        }
      },
      orderBy: {
        paidAt: 'desc'
      }
    })

    return NextResponse.json(installments)
  } catch (error) {
    console.error('Error fetching payment history:', error)
    return NextResponse.json(
      {error: 'Failed to fetch payment history'},
      {status: 500}
    )
  }
} 
