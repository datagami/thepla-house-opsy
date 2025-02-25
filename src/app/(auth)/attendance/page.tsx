import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AttendanceTable } from "@/components/attendance/attendance-table";
import { DailyAttendanceView } from "@/components/attendance/daily-attendance-view";
import { SharedAttendanceTable } from "@/components/attendance/shared-attendance-table";

export const metadata: Metadata = {
  title: "Attendance Management - HRMS",
  description: "Manage attendance in the HRMS system",
};

export default async function AttendancePage() {
  const session = await auth();

  if (!session || !session.user.branchId) {
    redirect("/dashboard");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const users = await prisma.user.findMany({
    where: {
      branchId: session.user.branchId,
      role: "EMPLOYEE",
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      attendance: {
        where: {
          date: today,
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
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  const pendingUsers = users.filter(user => !user.attendance.length);
  const markedUsers = users.filter(user => user.attendance.length);

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Attendance Management</h2>
      </div>

      {pendingUsers.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Pending Attendance ({pendingUsers.length})</h3>
          <div className="rounded-md border">
            <SharedAttendanceTable 
              users={pendingUsers} 
              date={today}
              userRole={session.user.role}
            />
          </div>
        </div>
      )}

      {markedUsers.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Marked Attendance ({markedUsers.length})</h3>
          <div className="rounded-md border">
            <SharedAttendanceTable 
              users={markedUsers} 
              date={today}
              userRole={session.user.role}
            />
          </div>
        </div>
      )}
    </div>
  );
} 