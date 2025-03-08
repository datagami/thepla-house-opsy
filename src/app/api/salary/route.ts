import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {auth} from "@/auth";

export async function GET(req: Request) {
  try {
    const session = await auth();
    // @ts-expect-error - role is not in the User type
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const month = parseInt(searchParams.get('month') || '')
    const year = parseInt(searchParams.get('year') || '')

    if (!month || !year) {
      return new NextResponse('Month and year are required', { status: 400 })
    }

    const salaries = await prisma.salary.findMany({
      where: {
        month,
        year,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(salaries)
  } catch (error) {
    console.error('Error fetching salaries:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 
