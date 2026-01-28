import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, CalendarCheck, CalendarClock } from "lucide-react";
import { SharedAttendanceTable } from "@/components/attendance/shared-attendance-table";
import { User, Branch } from "@/models/models";
import { DatePicker } from "@/components/attendance/date-picker";
import { ManageAttendanceFilters } from "@/components/attendance/manage-attendance-filters";

export const metadata: Metadata = {
  title: "Manage Attendance - HRMS",
  description: "Manage attendance for all users with role, status, and weekly off filters",
};

export default async function HRManageAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    weeklyOff?: string;
    branch?: string;
    role?: string;
    status?: string;
  }>;
}) {
  const session = await auth();

  // @ts-expect-error - We check for HR role
  const userRole = session.user.role;
  if (!session || (userRole !== "HR" && userRole !== "MANAGEMENT")) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const { date, weeklyOff, branch, role, status } = params;

  // Get the date from query params or use today
  const selectedDate = date ? new Date(date) : new Date();
  selectedDate.setHours(0, 0, 0, 0);

  // Build the where clause with filters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  // Apply role filter
  if (role && role !== "ALL") {
    where.role = role;
  }

  // Apply status filter (default to ACTIVE if not specified)
  if (status && status !== "ALL") {
    where.status = status;
  } else {
    // Default to ACTIVE users only
    where.status = "ACTIVE";
  }

  // Apply weekly off filters (multi-select)
  // Only apply filter if weeklyOff param exists
  if (weeklyOff) {
    const filters = weeklyOff.split(",");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orConditions: any[] = [];

    for (const filter of filters) {
      if (filter === "none") {
        orConditions.push({ hasWeeklyOff: false });
      } else if (filter === "flexible") {
        orConditions.push({
          hasWeeklyOff: true,
          weeklyOffType: "FLEXIBLE",
        });
      } else if (/^[0-6]$/.test(filter)) {
        // Fixed day filters: require hasWeeklyOff + FIXED + matching day
        orConditions.push({
          hasWeeklyOff: true,
          weeklyOffType: "FIXED",
          weeklyOffDay: parseInt(filter),
        });
      }
    }

    if (orConditions.length > 0) {
      where.OR = orConditions;
    }
  }

  if (branch && branch !== "ALL") {
    where.branchId = branch;
  }

  // Get all users matching filters
  const users = (await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      numId: true,
      role: true,
      hasWeeklyOff: true,
      weeklyOffType: true,
      weeklyOffDay: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      branch: {
        select: {
          id: true,
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
          isWeeklyOff: true,
          isWorkFromHome: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  })) as User[];

  // Get branches for filter
  const branches = (await prisma.branch.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  })) as Branch[];

  // Calculate statistics
  const totalUsers = users.length;
  const withWeeklyOff = users.filter((u) => u.hasWeeklyOff).length;
  const fixedWeeklyOff = users.filter((u) => u.weeklyOffType === "FIXED").length;
  const flexibleWeeklyOff = users.filter((u) => u.weeklyOffType === "FLEXIBLE").length;
  const markedAttendance = users.filter((u) => u.attendance.length > 0).length;

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Manage Attendance</h2>
        <div className="flex items-center gap-4">
          <DatePicker date={selectedDate} />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">matching filters</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Weekly Off</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{withWeeklyOff}</div>
            <p className="text-xs text-muted-foreground">
              Fixed: {fixedWeeklyOff} | Flexible: {flexibleWeeklyOff}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance Marked</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{markedAttendance}</div>
            <p className="text-xs text-muted-foreground">
              for {selectedDate.toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers - markedAttendance}</div>
            <p className="text-xs text-muted-foreground">yet to mark attendance</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <ManageAttendanceFilters branches={branches} />
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <div className="rounded-md border">
        <SharedAttendanceTable
          users={users}
          date={selectedDate}
          showBranch={true}
          showRole={true}
          isHR={true}
          userRole={userRole}
        />
      </div>
    </div>
  );
}
