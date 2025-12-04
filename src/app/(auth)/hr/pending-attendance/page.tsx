import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileClock } from "lucide-react";
import { SharedAttendanceTable } from "@/components/attendance/shared-attendance-table";
import { User } from "@/models/models";
import { DatePicker } from "@/components/attendance/date-picker";

export const metadata: Metadata = {
  title: "Pending Attendance - HRMS",
  description: "View all pending attendance records",
};

export default async function PendingAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();

  // @ts-expect-error - We check for HR role
  const role = session.user.role;
  if (!session || role !== "HR") {
    redirect("/dashboard");
  }

  const {date} = await searchParams;

  // Get the date from query params or use today
  const selectedDate = date
    ? new Date(date)
    : new Date();
  selectedDate.setHours(0, 0, 0, 0);

  // Get all employees who haven't marked attendance
  const users = await prisma.user.findMany({
    where: {
      role: "EMPLOYEE",
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      department: true,
      branch: {
        select: {
          name: true,
        },
      },
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
          notes: true,
          status: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  }) as User[];

  // Filter users who haven't marked attendance
  const pendingUsers = users.filter(user => !user.attendance.length);

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Pending Attendance</h2>
        <div className="flex items-center gap-4">
          <DatePicker date={selectedDate} />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Pending Attendance
          </CardTitle>
          <FileClock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pendingUsers.length}</div>
          <p className="text-xs text-muted-foreground">
            employees haven&#39;t marked attendance for {selectedDate.toLocaleDateString()}
          </p>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <SharedAttendanceTable 
          users={pendingUsers} 
          date={selectedDate}
          showBranch={true}
          isHR={true}
          userRole={role}
        />
      </div>
    </div>
  );
} 