import { prisma } from '@/lib/prisma';

/**
 * Service for automatically creating weekly off attendance records
 * For employees with fixed weekly off, this creates attendance records
 * on their specified weekly off day each week
 */

/**
 * Create weekly off attendance for a specific user and date
 * @param userId - User ID
 * @param date - Date for the weekly off
 * @returns Created attendance record or null if already exists
 */
export async function createWeeklyOffAttendance(
  userId: string,
  date: Date
): Promise<any | null> {
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
    return null;
  }

  // Check if it's the correct day of week
  const dayOfWeek = date.getDay();
  if (user.weeklyOffDay !== dayOfWeek) {
    return null;
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
      return await prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          isWeeklyOff: true,
          isPresent: true,
          status: 'APPROVED',
        },
      });
    }
    return existingAttendance;
  }

  // Create new weekly off attendance
  if (!user.branchId) {
    throw new Error(`User ${userId} does not have a branch assigned`);
  }

  return await prisma.attendance.create({
    data: {
      userId,
      date: startOfDay,
      isPresent: true,
      isWeeklyOff: true,
      status: 'APPROVED',
      branchId: user.branchId,
    },
  });
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
  // Get all users with fixed weekly off
  const users = await prisma.user.findMany({
    where: {
      hasWeeklyOff: true,
      weeklyOffType: 'FIXED',
      branchId: { not: null },
    },
    select: {
      id: true,
      weeklyOffDay: true,
      branchId: true,
    },
  });

  let createdCount = 0;

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
        const attendance = await createWeeklyOffAttendance(user.id, currentDate);
        if (attendance) {
          createdCount++;
        }
      } catch (error) {
        console.error(
          `Error creating weekly off attendance for user ${user.id} on ${currentDate.toISOString()}:`,
          error
        );
        // Continue with other users
      }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return createdCount;
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
