import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { status } = await request.json()
    
    const updatedSalary = await prisma.salary.update({
      where: { id: params.id },
      data: { status },
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
