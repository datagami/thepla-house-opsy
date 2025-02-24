import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { HRAttendanceTable } from "@/components/hr/attendance-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileClock } from "lucide-react";

export default async function HRAttendancePage() {
  const session = await auth();

  if (!session || session.user.role !== "HR") {
    redirect("/dashboard");
  }

  // Get today's date at start of day
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all branch managers and their attendance for today
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
      },
    },
  });

  // Count managers without attendance
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
            branch managers haven't marked attendance today
          </p>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <HRAttendanceTable managers={branchManagers} />
      </div>
    </div>
  );
} 