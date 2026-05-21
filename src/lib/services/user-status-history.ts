import { prisma } from '@/lib/prisma';
import { UserStatus, type UserStatusHistory } from '@prisma/client';
import { eachDayOfInterval, endOfDay, format } from 'date-fns';

export const NOT_WORKING_STATUSES: ReadonlySet<UserStatus> = new Set<UserStatus>([
  UserStatus.INACTIVE,
  UserStatus.PARTIAL_INACTIVE,
]);

/**
 * Resolve the effective UserStatus on a given date by walking sorted history.
 * Returns null if the date predates the earliest history entry.
 *
 * `history` MUST be sorted ascending by `changedAt`.
 */
export function resolveStatusOnDate(
  history: UserStatusHistory[],
  date: Date,
): UserStatus | null {
  if (history.length === 0) return null;
  let effective: UserStatus | null = null;
  for (const row of history) {
    if (row.changedAt.getTime() <= date.getTime()) {
      effective = row.toStatus;
    } else {
      break;
    }
  }
  return effective;
}

/**
 * Return the set of date keys ("yyyy-MM-dd") within [startDate, endDate]
 * during which the user was in a NOT_WORKING_STATUSES status.
 *
 * Returns an empty Set when no history exists (defensive for pre-backfill users).
 */
export async function getInactiveDateKeysInRange(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<Set<string>> {
  const history = await prisma.userStatusHistory.findMany({
    where: { userId, changedAt: { lte: endDate } },
    orderBy: { changedAt: 'asc' },
  });

  const keys = new Set<string>();
  if (history.length === 0) return keys;

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  for (const day of days) {
    // Evaluate at end-of-day so any status change happening during the day
    // (or earlier) counts toward that day's classification.
    const status = resolveStatusOnDate(history, endOfDay(day));
    if (status !== null && NOT_WORKING_STATUSES.has(status)) {
      keys.add(format(day, 'yyyy-MM-dd'));
    }
  }
  return keys;
}
