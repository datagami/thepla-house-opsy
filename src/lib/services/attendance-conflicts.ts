import { prisma } from "@/lib/prisma";
import { endOfMonth, startOfMonth } from "date-fns";

const ATTENDANCE_TIMEZONE_OFFSET_MINUTES = Number(
  process.env.ATTENDANCE_TIMEZONE_OFFSET_MINUTES ?? 330 // Default to IST (+5:30)
);

const shiftByOffset = (date: Date, offsetMinutes: number) => {
  return new Date(date.getTime() + offsetMinutes * 60 * 1000);
};

type AttendanceConflictEntry = {
  id: string;
  isPresent: boolean;
  isWeeklyOff?: boolean;
  isWorkFromHome?: boolean;
  isHalfDay: boolean;
  overtime: boolean;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  createdAt: Date;
  updatedAt: Date;
  verifiedAt: Date | null;
  verifiedByName: string | null;
  verificationNote: string | null;
};

export type AttendanceConflictGroup = {
  userId: string;
  userName: string | null;
  department: string | null;
  branchName: string | null;
  date: string;
  entries: AttendanceConflictEntry[];
};

const getDayKey = (date: Date) => {
  const localDate = shiftByOffset(date, ATTENDANCE_TIMEZONE_OFFSET_MINUTES);
  localDate.setUTCHours(0, 0, 0, 0);
  return localDate.toISOString().split("T")[0];
};

export async function getAttendanceConflicts(month: number, year: number) {
  if (!month || !year) {
    throw new Error("Month and year are required to find attendance conflicts");
  }

  const utcMonthStart = startOfMonth(new Date(Date.UTC(year, month - 1, 1)));
  const utcMonthEnd = endOfMonth(utcMonthStart);

  const rangeStart = shiftByOffset(
    utcMonthStart,
    -ATTENDANCE_TIMEZONE_OFFSET_MINUTES
  );
  const rangeEnd = shiftByOffset(
    utcMonthEnd,
    -ATTENDANCE_TIMEZONE_OFFSET_MINUTES
  );

  const records = await prisma.attendance.findMany({
    where: {
      date: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          branch: {
            select: {
              name: true,
            },
          },
        },
      },
      verifiedBy: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [
      { date: "asc" },
      { userId: "asc" },
      { createdAt: "asc" },
    ],
  });

  const grouped = new Map<string, AttendanceConflictGroup>();

  for (const record of records) {
    const dayKey = getDayKey(record.date);
    const mapKey = `${record.userId}-${dayKey}`;

    if (!grouped.has(mapKey)) {
      grouped.set(mapKey, {
        userId: record.userId,
        userName: record.user?.name ?? null,
        department: record.user?.department?.name ?? null,
        branchName: record.user?.branch?.name ?? null,
        date: dayKey,
        entries: [],
      });
    }

    grouped.get(mapKey)!.entries.push({
      id: record.id,
      isPresent: record.isPresent,
      isWeeklyOff: record.isWeeklyOff,
      isWorkFromHome: record.isWorkFromHome,
      isHalfDay: record.isHalfDay,
      overtime: record.overtime,
      status: record.status,
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      verifiedAt: record.verifiedAt,
      verifiedByName: record.verifiedBy?.name ?? null,
      verificationNote: record.verificationNote,
    });
  }

  return Array.from(grouped.values())
    .filter((group) => group.entries.length > 1)
    .sort((a, b) => {
      if (a.date === b.date) {
        return (a.userName ?? "").localeCompare(b.userName ?? "");
      }
      return a.date.localeCompare(b.date);
    });
}

export async function hasAttendanceConflicts(month: number, year: number) {
  const conflicts = await getAttendanceConflicts(month, year);
  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
}

