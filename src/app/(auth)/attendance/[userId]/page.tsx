import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { AttendanceCalendar } from "@/components/attendance/attendance-calendar";
import { AttendanceStats } from "@/components/attendance/attendance-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {Attendance} from "@/models/models";

export const metadata: Metadata = {
  title: "Employee Attendance - HRMS",
  description: "View employee attendance details",
};

export default async function EmployeeAttendancePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  const {userId} = await params;

  if (!session) {
    redirect("/login");
  }

  // Get employee details
  const employee = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      branch: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!employee) {
    redirect("/dashboard");
  }

  // Get current month's date range
  const today = new Date();
  const startDate = startOfMonth(today);
  const endDate = endOfMonth(today);

  // Get attendance for the month
  const attendance = await prisma.attendance.findMany({
    where: {
      userId: userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      date: "asc",
    },
  });

  // Calculate statistics
  const stats = {
    totalDays: attendance.length,
    presentDays: attendance.filter(a => a.isPresent).length,
    absentDays: attendance.filter(a => !a.isPresent).length,
    halfDays: attendance.filter(a => a.isHalfDay).length,
    overtimeDays: attendance.filter(a => a.overtime).length,
  };

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{employee.name}</h2>
          <p className="text-muted-foreground">{employee.branch?.name}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDays}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.presentDays}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absent Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.absentDays}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Half Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.halfDays}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overtime Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.overtimeDays}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="rounded-md border bg-card">
          <div className="p-6">
            <h3 className="text-lg font-medium">
              Attendance Calendar - {format(startDate, "MMMM yyyy")}
            </h3>
            <AttendanceCalendar 
              attendance={attendance}
              month={startDate}
            />
          </div>
        </div>

        <div className="rounded-md border bg-card">
          <div className="p-6">
            <h3 className="text-lg font-medium">Monthly Statistics</h3>
            <AttendanceStats 
              attendance={attendance as Attendance[]}
              month={startDate}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 
