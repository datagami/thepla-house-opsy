import { prisma } from '@/lib/prisma';
import type { Attendance } from '@prisma/client';
import { ActivityType } from '@prisma/client';
import { logActivity } from '@/lib/services/activity-log';

/**
 * Service for automatically creating weekly off attendance records
 * For employees with fixed weekly off, this creates attendance records
 * on their specified weekly off day each week
 */

/**
 * Result of creating weekly off attendance
 */
export interface CreateWeeklyOffResult {
  attendance: Attendance | null;
  action: 'created' | 'updated' | 'skipped' | 'no_match';
}

/**
 * Create weekly off attendance for a specific user and date
 * @param userId - User ID
 * @param date - Date for the weekly off
 * @returns Result with attendance record and action taken
 */
export async function createWeeklyOffAttendance(
  userId: string,
  date: Date
): Promise<CreateWeeklyOffResult> {
  // Get user's weekly off configuration
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      hasWeeklyOff: true,
      weeklyOffType: true,
      weeklyOffDay: true,
      branchId: true,
    },
  });

  if (!user || !user.hasWeeklyOff || user.weeklyOffType !== 'FIXED') {
    return { attendance: null, action: 'no_match' };
  }

  // Check if it's the correct day of week
  const dayOfWeek = date.getDay();
  if (user.weeklyOffDay !== dayOfWeek) {
    return { attendance: null, action: 'no_match' };
  }

  // Check if attendance already exists for this date
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const existingAttendance = await prisma.attendance.findFirst({
    where: {
      userId,
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  if (existingAttendance) {
    // Update existing attendance to mark as weekly off if not already
    if (!existingAttendance.isWeeklyOff) {
      const updated = await prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          isWeeklyOff: true,
          isPresent: true,
          status: 'APPROVED',
          notes: existingAttendance.notes
            ? `${existingAttendance.notes}\n[System]: Marked as weekly off by cron job`
            : 'Marked as weekly off by system cron job',
        },
      });

      // Log activity
      await logActivity({
        activityType: ActivityType.ATTENDANCE_UPDATED,
        targetUserId: userId,
        targetId: updated.id,
        entityType: 'Attendance',
        description: `Marked as weekly off by system cron job for date ${startOfDay.toLocaleDateString()}`,
        metadata: {
          automated: true,
          previousStatus: existingAttendance.status,
          date: startOfDay.toISOString()
        }
      });

      return { attendance: updated, action: 'updated' };
    }
    return { attendance: existingAttendance, action: 'skipped' };
  }

  // Create new weekly off attendance
  if (!user.branchId) {
    throw new Error(`User ${userId} does not have a branch assigned`);
  }

  const created = await prisma.attendance.create({
    data: {
      userId,
      date: startOfDay,
      isPresent: true,
      isWeeklyOff: true,
      status: 'APPROVED',
      branchId: user.branchId,
      notes: 'Marked as weekly off by system cron job',
    },
  });

  // Log activity
  await logActivity({
    activityType: ActivityType.ATTENDANCE_CREATED,
    targetUserId: userId,
    targetId: created.id,
    entityType: 'Attendance',
    description: `Automatically created weekly off attendance by system cron job for date ${startOfDay.toLocaleDateString()}`,
    metadata: {
      automated: true,
      date: startOfDay.toISOString()
    }
  });

  return { attendance: created, action: 'created' };
}

/**
 * Result type for weekly off attendance creation
 */
export interface WeeklyOffResult {
  userId: string;
  userName: string;
  userEmail: string | null;
  date: Date;
  dayOfWeek: number;
  dayName: string;
  action: 'created' | 'updated' | 'skipped';
  attendanceId: string | null;
}

/**
 * Create weekly off attendance for all employees with fixed weekly off
 * for a specific date range
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @returns Number of attendance records created
 */
export async function createWeeklyOffAttendanceForDateRange(
  startDate: Date,
  endDate: Date
): Promise<number> {
  const results = await createWeeklyOffAttendanceForDateRangeWithDetails(startDate, endDate);
  return results.filter(r => r.action !== 'skipped').length;
}

/**
 * Create weekly off attendance for all employees with fixed weekly off
 * for a specific date range with detailed results
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @returns Array of results with user details
 */
export async function createWeeklyOffAttendanceForDateRangeWithDetails(
  startDate: Date,
  endDate: Date
): Promise<WeeklyOffResult[]> {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Get all users with fixed weekly off
  const users = await prisma.user.findMany({
    where: {
      hasWeeklyOff: true,
      weeklyOffType: 'FIXED',
      branchId: { not: null },
    },
    select: {
      id: true,
      name: true,
      email: true,
      weeklyOffDay: true,
      branchId: true,
    },
  });

  const results: WeeklyOffResult[] = [];

  // Iterate through each day in the date range
  const currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();

    // Find users whose weekly off day matches today
    const usersForToday = users.filter((user) => user.weeklyOffDay === dayOfWeek);

    for (const user of usersForToday) {
      try {
        const result = await createWeeklyOffAttendance(user.id, currentDate);
        // Only include in results if action was 'created' or 'updated' (not 'skipped' or 'no_match')
        if (result.action === 'created' || result.action === 'updated') {
          results.push({
            userId: user.id,
            userName: user.name || 'Unknown',
            userEmail: user.email,
            date: new Date(currentDate),
            dayOfWeek,
            dayName: dayNames[dayOfWeek],
            action: result.action,
            attendanceId: result.attendance?.id || null,
          });
        }
      } catch (error) {
        console.error(
          `Error creating weekly off attendance for user ${user.id} (${user.name || user.email}) on ${currentDate.toISOString()}:`,
          error
        );
        // Continue with other users
      }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return results;
}

/**
 * Create weekly off attendance for the current week
 * Useful for scheduled jobs or manual triggers
 */
export async function createWeeklyOffAttendanceForCurrentWeek(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get start of week (Sunday)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  // Get end of week (Saturday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return await createWeeklyOffAttendanceForDateRange(startOfWeek, endOfWeek);
}

/**
 * Create weekly off attendance for the current week with detailed results
 * Useful for scheduled jobs or manual triggers that need user details
 */
export async function createWeeklyOffAttendanceForCurrentWeekWithDetails() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get start of week (Sunday)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  // Get end of week (Saturday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return await createWeeklyOffAttendanceForDateRangeWithDetails(startOfWeek, endOfWeek);
}

/**
 * Create weekly off attendance for today only
 * Finds all users with weekly off on today's day of week and marks them
 * 
 * @returns Array of results with user details for today
 */
export async function createWeeklyOffAttendanceForTodayWithDetails(): Promise<WeeklyOffResult[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  console.log(`Processing weekly off for today: ${dayNames[dayOfWeek]} (day ${dayOfWeek})`);
  console.log(`Date: ${today.toISOString()}`);

  // Get all users with fixed weekly off matching today's day
  const users = await prisma.user.findMany({
    where: {
      hasWeeklyOff: true,
      weeklyOffType: 'FIXED',
      weeklyOffDay: dayOfWeek, // Only users with weekly off on today's day
      branchId: { not: null },
    },
    select: {
      id: true,
      name: true,
      email: true,
      weeklyOffDay: true,
      branchId: true,
    },
  });

  console.log(`Found ${users.length} user(s) with weekly off on ${dayNames[dayOfWeek]}`);

  const results: WeeklyOffResult[] = [];

  for (const user of users) {
    try {
      const result = await createWeeklyOffAttendance(user.id, today);
      // Only include in results if action was 'created' or 'updated' (not 'skipped' or 'no_match')
      if (result.action === 'created' || result.action === 'updated') {
        results.push({
          userId: user.id,
          userName: user.name || 'Unknown',
          userEmail: user.email,
          date: new Date(today),
          dayOfWeek,
          dayName: dayNames[dayOfWeek],
          action: result.action,
          attendanceId: result.attendance?.id || null,
        });
      }
    } catch (error) {
      console.error(
        `Error creating weekly off attendance for user ${user.id} (${user.name || user.email}) on ${today.toISOString()}:`,
        error
      );
      // Continue with other users
    }
  }

  return results;
}

/**
 * Create weekly off attendance for today only
 * Returns count of records created/updated
 */
export async function createWeeklyOffAttendanceForToday(): Promise<number> {
  const results = await createWeeklyOffAttendanceForTodayWithDetails();
  return results.length;
}

/**
 * Create weekly off attendance for the current month
 * Useful for monthly batch processing
 */
export async function createWeeklyOffAttendanceForCurrentMonth(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get start of month
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Get end of month
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);

  return await createWeeklyOffAttendanceForDateRange(startOfMonth, endOfMonth);
}
