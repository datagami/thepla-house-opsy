import { prisma } from '@/lib/prisma'


import { NextResponse } from 'next/server'
import {auth} from "@/auth";

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { userId, amount, reason, emiAmount } = await req.json()

    // Validate request
    if (!userId || !amount || !emiAmount) {
      return new Response('Missing required fields', { status: 400 })
    }

    // Get user's current advance balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totalAdvanceBalance: true }
    })

    if (!user) {
      return new Response('User not found', { status: 404 })
    }

    // Create advance payment request
    const advancePayment = await prisma.advancePayment.create({
      data: {
        userId,
        amount,
        emiAmount,
        remainingAmount: amount,
        reason,
        status: 'PENDING',
      }
    })

    return NextResponse.json(advancePayment)
  } catch (error) {
    console.error('Error creating advance payment:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

// Get all advance payments for a user
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return new Response('User ID is required', { status: 400 })
    }

    const advancePayments = await prisma.advancePayment.findMany({
      where: { userId },
      include: {
        approvedBy: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(advancePayments)
  } catch (error) {
    console.error('Error fetching advance payments:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
} 
