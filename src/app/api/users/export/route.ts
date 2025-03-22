import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { auth } from "@/auth"

export async function GET() {
  try {
    const session = await auth()
    // @ts-expect-error - role is not in the User type
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const users = await prisma.user.findMany({
      select: {
        name: true,
        email: true,
        mobileNo: true,
        gender: true,
        department: true,
        title: true,
        role: true,
        branch: true,
        dob: true,
        doj: true,
        salary: true,
        panNo: true,
        aadharNo: true,
        bankAccountNo: true,
        bankIfscCode: true,
        references: {
          select: {
            name: true,
            contactNo: true
          }
        }
      }
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Export failed:', error)
    return NextResponse.json(
      { error: 'Failed to export users' },
      { status: 500 }
    )
  }
} 