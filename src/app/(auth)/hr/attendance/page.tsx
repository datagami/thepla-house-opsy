import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileClock, AlertTriangle } from "lucide-react";
import { SharedAttendanceTable } from "@/components/attendance/shared-attendance-table";
import { User } from "@/models/models";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isToday, isPast } from "date-fns";
import { DatePicker } from "@/components/attendance/date-picker";

export default async function HRAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();

  // @ts-expect-error - We check for HR or MANAGEMENT role
  const role = session?.user?.role;
  if (!session || !["HR", "MANAGEMENT"].includes(role)) {
    redirect("/dashboard");
  }

  const {date} = await searchParams;

  // Get the date from query params or use today
  const selectedDate = date
    ? new Date(date)
    : new Date();
  selectedDate.setHours(0, 0, 0, 0);

  const isSelectedDatePast = isPast(selectedDate) && !isToday(selectedDate);

  const branchManagers = await prisma.user.findMany({
    where: {
      role: "BRANCH_MANAGER",
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      department: true,
      managedBranch: {
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
  }) as User[];

  const pendingManagersCount = branchManagers.filter(
    (manager) => manager.attendance.length === 0
  ).length;

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Branch Manager Attendance</h2>
        <div className="flex items-center gap-4">
          <DatePicker date={selectedDate} />
        </div>
      </div>

      {isSelectedDatePast && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Viewing Past Attendance</AlertTitle>
          <AlertDescription>
            You are viewing attendance for a past date. Changes to attendance records may affect salary calculations.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Pending Manager Attendance
          </CardTitle>
          <FileClock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pendingManagersCount}</div>
          <p className="text-xs text-muted-foreground">
            branch managers haven&#39;t marked attendance for {selectedDate.toLocaleDateString()}
          </p>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <SharedAttendanceTable 
          users={branchManagers} 
          date={selectedDate}
          showBranch={true}
          isHR={true}
          userRole={role}
        />
      </div>
    </div>
  );
} 
