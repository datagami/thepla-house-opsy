import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {auth} from "@/auth";
import { userIdentitySelect } from "@/lib/select-presets";

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
    const referralOnly = searchParams.get('referralOnly') === 'true'

    if (!month || !year) {
      return new NextResponse('Month and year are required', { status: 400 })
    }

    const salaries = await prisma.salary.findMany({
      where: {
        month,
        year,
        ...(referralOnly ? {
          referrals: {
            some: {
              salaryId: { not: null }
            }
          }
        } : {})
      },
      select: {
        id: true,
        numId: true,
        userId: true,
        month: true,
        year: true,
        baseSalary: true,
        advanceDeduction: true,
        deductions: true,
        overtimeBonus: true,
        otherBonuses: true,
        otherDeductions: true,
        netSalary: true,
        presentDays: true,
        overtimeDays: true,
        halfDays: true,
        leavesEarned: true,
        leaveSalary: true,
        status: true,
        paidAt: true,
        createdAt: true,
        updatedAt: true,
        recurringDeductions: true,
        user: {
          select: {
            ...userIdentitySelect,
            email: true,
            role: true,
            status: true,
            branchId: true,
          },
        },
        installments: true,
        referrals: {
          select: {
            id: true,
            numId: true,
            referrerId: true,
            referredUserId: true,
            bonusAmount: true,
            eligibleAt: true,
            paidAt: true,
            salaryId: true,
            archivedAt: true,
            referredUser: {
              select: {
                ...userIdentitySelect,
                status: true,
                doj: true,
              },
            },
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
