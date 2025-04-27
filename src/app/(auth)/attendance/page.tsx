import { Metadata } from "next";
import { auth } from "@/auth";
import {redirect} from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AttendanceTable } from "@/components/attendance/attendance-table";
import { DailyAttendanceView } from "@/components/attendance/daily-attendance-view";
import { User } from "@/models/models";
import { DateSwitcher } from "@/components/attendance/date-switcher";

export const metadata: Metadata = {
  title: "Attendance Management - HRMS",
  description: "Manage attendance in the HRMS system",
};

interface Props {
  searchParams: Promise<{
    date?: string;
  }>;
}

export default async function AttendancePage({ searchParams }: Props) {
  const session = await auth();

  // @ts-expect-error - branchId is not defined in the session type
  if (!session?.user.branchId) {
    redirect("/dashboard");
  }

  const searchParamDate = (await searchParams).date;
  // Parse the date from searchParams or use today
  const selectedDate = searchParamDate ? new Date(searchParamDate) : new Date();
  selectedDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = selectedDate.toISOString() === today.toISOString();

  const users = await prisma.user.findMany({
    where: {
      // @ts-expect-error - branchId is not defined in the session type
      branchId: session.user.branchId,
      role: "EMPLOYEE",
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      department: true,
      attendance: {
        where: {
          date: selectedDate,
        },
        select: {
          id: true,
          isPresent: true,
          checkIn: true,
          checkOut: true,
          isHalfDay: true,
          overtime: true,
          shift1: true,
          shift2: true,
          shift3: true,
          status: true,
          verifiedAt: true,
          verifiedBy: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  // Separate users with pending attendance
  const pendingUsers = users.filter(user => !user.attendance.length) as User[];
  const markedUsers = users.filter(user => user.attendance.length) as User[];

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Attendance Management</h2>
        <DateSwitcher currentDate={selectedDate} />
      </div>

      {isToday && pendingUsers.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Pending Attendance ({pendingUsers.length})</h3>
          <div className="rounded-md border">
            <AttendanceTable users={pendingUsers} date={selectedDate} />
          </div>
        </div>
      )}

      <DailyAttendanceView markedUsers={markedUsers} pendingUsers={pendingUsers} viewOnly={!isToday} />
    </div>
  );
} 
