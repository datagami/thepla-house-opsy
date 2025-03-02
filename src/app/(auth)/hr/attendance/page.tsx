import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileClock } from "lucide-react";
import { SharedAttendanceTable } from "@/components/attendance/shared-attendance-table";

export default async function HRAttendancePage() {
  const session = await auth();

  // @ts-expect-error - We check for HR role
  const role = session.user.role
  if (!session || role !== "HR") {
    redirect("/dashboard");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const branchManagers = await prisma.user.findMany({
    where: {
      role: "BRANCH_MANAGER",
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      managedBranch: {
        select: {
          name: true,
        },
      },
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
  });

  const pendingManagersCount = branchManagers.filter(
    manager => manager.attendance.length === 0
  ).length;

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Branch Manager Attendance</h2>
      </div>

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
            branch managers haven&#39;t marked attendance today
          </p>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <SharedAttendanceTable 
          users={branchManagers} 
          date={today}
          showBranch={true}
          isHR={true}
          userRole={role}
        />
      </div>
    </div>
  );
} 
