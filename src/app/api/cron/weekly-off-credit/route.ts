import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createWeekOffCredit, hasWeeklyGrantForDate } from '@/lib/services/week-off-balance'

/**
 * Cron job endpoint for crediting weekly off balance every Sunday.
 * For all ACTIVE users with hasWeeklyOff = true, adds +1 WEEKLY_GRANT.
 * Idempotent: skips users who already have a grant for today.
 *
 * Recommended schedule: Every Sunday at 1:00 AM (0 1 * * 0)
 * Security: Protected by CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const timestamp = new Date().toISOString()
  const istTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })

  // Security: Verify the request is from an authorized source
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid or missing CRON_SECRET', timestamp },
      { status: 401 }
    )
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get all active users with weekly off enabled, joined on or before today
    const users = await prisma.user.findMany({
      where: {
        hasWeeklyOff: true,
        status: 'ACTIVE',
        // Use date of joining (doj) to determine eligibility; fall back to createdAt via OR
        OR: [
          { doj: { lte: today } },
          { doj: null, createdAt: { lte: today } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    let credited = 0
    let skipped = 0
    const creditedUsers: Array<{ id: string; name: string | null }> = []

    for (const user of users) {
      // Idempotent: check if grant already exists for today
      const alreadyGranted = await hasWeeklyGrantForDate(user.id, today)
      if (alreadyGranted) {
        skipped++
        continue
      }

      await createWeekOffCredit({
        userId: user.id,
        date: today,
        type: 'CREDIT',
        reason: 'WEEKLY_GRANT',
        amount: 1,
        createdBy: 'system:weekly-off-credit-cron',
      })

      credited++
      creditedUsers.push({ id: user.id, name: user.name })
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: `Credited ${credited} users, skipped ${skipped}`,
      credited,
      skipped,
      totalEligible: users.length,
      duration: `${duration}ms`,
      timestamp,
      istTime,
      creditedUsers,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error('Weekly off credit cron error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to credit weekly off balance',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
        istTime,
        duration: `${duration}ms`,
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
