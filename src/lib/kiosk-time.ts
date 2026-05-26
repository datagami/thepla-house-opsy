/**
 * IST (Asia/Kolkata) helpers for kiosk attendance.
 *
 * The kiosk sends `punchedAt` as UTC. Attendance.checkIn/checkOut are bare
 * "HH:mm" strings (per existing convention), and Attendance.date is the
 * calendar day — both must be in IST so a near-midnight punch lands on
 * the right day and time.
 */

const IST_TZ = 'Asia/Kolkata';

/**
 * Convert a UTC Date to its IST "HH:mm" 24-hour string.
 * Used to populate Attendance.checkIn / Attendance.checkOut.
 */
export function toISTTimeString(utc: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(utc);
}

/**
 * Convert a UTC Date to the IST calendar day, returned as a Date whose
 * UTC components are midnight of that IST day (so it round-trips through
 * Prisma's DateTime column the same way existing Attendance.date does).
 */
export function toISTDate(utc: Date): Date {
  // en-CA gives ISO-style YYYY-MM-DD
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(utc);
  return new Date(`${ymd}T00:00:00.000Z`);
}
