import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, format, addMonths, subMonths } from "date-fns";
import { AttendanceStats } from "@/components/attendance/attendance-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Attendance, User } from "@/models/models";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { DetailedAttendanceCalendar } from "@/components/attendance/detailed-attendance-calendar";
import { SalaryActions } from "@/components/salary/salary-actions";

export const metadata: Metadata = {
  title: "Employee Attendance - HRMS",
  description: "View employee attendance details",
};

export default async function EmployeeAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await auth();
  const { userId } = await params;
  const { month } = await searchParams;

  // @ts-expect-error - session is not null
  const role = session?.user?.role;

  if (!session) {
    redirect("/login");
  }

  // If the user is not HR or MANAGEMENT, check permissions
  if (role !== "HR" && role !== "MANAGEMENT") {
    const loggedInUserId = session?.user?.id;
    
    // If viewing own attendance, allow
    if (userId === loggedInUserId) {
      // Allow viewing own attendance
    } 
    // If branch manager, check if employee belongs to their branch
    else if (role === "BRANCH_MANAGER") {
      // Get the branch manager's branch info
      const manager = await prisma.user.findUnique({
        where: { id: loggedInUserId as string },
        select: {
          managedBranchId: true,
          branchId: true,
        },
      });

      const managerBranchId = manager?.managedBranchId || manager?.branchId;

      if (!managerBranchId) {
        redirect("/dashboard");
      }

      // Get the employee's branch info
      const employee = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          branchId: true,
        },
      });

      // Check if employee belongs to manager's branch
      if (!employee || employee.branchId !== managerBranchId) {
        redirect("/dashboard");
      }
    } 
    // For other roles, only allow viewing own attendance
    else {
      redirect("/dashboard");
    }
  }

  // Get the month from query params or use current month
  const selectedMonth = month
    ? new Date(month)
    : new Date();

  const startDate = startOfMonth(selectedMonth);
  const endDate = endOfMonth(selectedMonth);

  // Get employee details
  const employee = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      salary: true,
      branch: {
        select: {
          name: true,
        },
      },
    },
  }) as User;

  if (!employee) {
    redirect("/dashboard");
  }

  // Get attendance for the selected month
  const attendance = await prisma.attendance.findMany({
    where: {
      userId: userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      branch: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      date: "asc",
    },
  }) as Attendance[];

  // Get salary for the selected month
  const salary = await prisma.salary.findFirst({
    where: {
      userId,
      month: startDate.getMonth() + 1,
      year: startDate.getFullYear(),
    },
  });

  // Calculate statistics
  const stats = {
    totalDays: attendance.length,
    presentDays: attendance.filter(a => a.isPresent && a.verifiedAt).length,
    absentDays: attendance.filter(a => !a.isPresent && a.verifiedAt).length,
    halfDays: attendance.filter(a => a.isHalfDay && a.verifiedAt).length,
    overtimeDays: attendance.filter(a => a.overtime && a.verifiedAt).length,
    pendingPresentDays: attendance.filter(a => a.isPresent && !a.verifiedAt).length,
    pendingAbsentDays: attendance.filter(a => !a.isPresent && !a.verifiedAt).length,
  };

  const prevMonth = format(subMonths(startDate, 1), "yyyy-MM");
  const nextMonth = format(addMonths(startDate, 1), "yyyy-MM");
  const isCurrentMonth = format(new Date(), "yyyy-MM") === format(startDate, "yyyy-MM");

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{employee.name}</h2>
          <p className="text-muted-foreground">{employee.branch?.name}</p>
        </div>
        {['HR', 'MANAGEMENT'].includes(role) && (
          <SalaryActions
            userId={userId}
            month={startDate.getMonth() + 1}
            year={startDate.getFullYear()}
            salary={salary}
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Attendance Calendar
        </h3>
        <div className="flex items-center gap-4">
          <Link href={`/attendance/${userId}?month=${prevMonth}`}>
            <Button
              variant="outline"
              size="sm">
              <ChevronLeft className="h-4 w-4" />
              Previous Month
            </Button>
          </Link>

          <span className="font-medium">
            {format(startDate, "MMMM yyyy")}
          </span>

          <Link href={`/attendance/${userId}?month=${nextMonth}`}>
            <Button
              variant="outline"
              size="sm"
              disabled={isCurrentMonth}
            >
              Next Month
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Marked Attendance</CardTitle>
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Present Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingPresentDays}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Absent Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.pendingAbsentDays}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="rounded-md border bg-card">
          <div className="p-6">
            <DetailedAttendanceCalendar 
              attendance={attendance}
              month={startDate}
              userId={employee.id}
              userName={employee.name || ""}
              userRole={role}
              department={employee.department?.name || ''}
            />
          </div>
        </div>

        <div className="rounded-md border bg-card">
          <div className="p-6">
            <h3 className="text-lg font-medium">Monthly Statistics</h3>
            <AttendanceStats
              user={employee}
              attendance={attendance}
              month={startDate}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 
