import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  try {
    const { salaryIds, status } = await request.json()

    if (!salaryIds || !Array.isArray(salaryIds) || salaryIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid salary IDs' },
        { status: 400 }
      )
    }

    const result = await prisma.salary.updateMany({
      where: {
        id: {
          in: salaryIds
        },
        status: 'PENDING' // Only update PENDING salaries
      },
      data: {
        status
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error updating salaries:', error)
    return NextResponse.json(
      { error: 'Failed to update salaries' },
      { status: 500 }
    )
  }
} 