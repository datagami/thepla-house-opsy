import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CalendarCheck, Users } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dashboard - HRMS",
  description: "Example dashboard page",
};

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  let stats = {};

  if (session.user.role === "BRANCH_MANAGER") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get total employees in branch
    const totalEmployees = await prisma.user.count({
      where: {
        branchId: session.user.branchId,
        role: "EMPLOYEE",
        status: "ACTIVE",
      },
    });

    // Get marked attendance count for today
    const markedAttendance = await prisma.attendance.count({
      where: {
        date: today,
        user: {
          branchId: session.user.branchId,
          role: "EMPLOYEE",
          status: "ACTIVE",
        },
      },
    });

    // Get pending leave requests
    const pendingLeaveRequests = await prisma.leaveRequest.count({
      where: {
        status: "PENDING",
        user: {
          branchId: session.user.branchId,
        },
      },
    });

    stats = {
      totalEmployees,
      markedAttendance,
      pendingAttendance: totalEmployees - markedAttendance,
      pendingLeaveRequests,
    };
  }

  if (session.user.role === "HR") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get pending manager attendance count
    const branchManagers = await prisma.user.findMany({
      where: {
        role: "BRANCH_MANAGER",
        status: "ACTIVE",
      },
      select: {
        id: true,
        attendance: {
          where: {
            date: today,
          },
        },
      },
    });

    const pendingManagerAttendance = branchManagers.filter(
      manager => manager.attendance.length === 0
    ).length;

    // Get pending attendance verifications
    const pendingVerifications = await prisma.attendance.count({
      where: {
        status: "PENDING",
        date: {
          lt: today,
        },
        user: {
          role: "EMPLOYEE",
          NOT: {
            status: "INACTIVE",
          },
        },
      },
    });

    // Get pending user approvals
    const pendingApprovals = await prisma.user.count({
      where: {
        status: "PENDING",
      },
    });

    stats = {
      pendingManagerAttendance,
      pendingVerifications,
      pendingApprovals,
    };
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {session.user.role === "BRANCH_MANAGER" && (
          <>
            <Link href="/attendance" className="block">
              <Card className="hover:bg-accent/5 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Pending Attendance
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingAttendance}</div>
                  <p className="text-xs text-muted-foreground">
                    employees haven't marked attendance today
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/leave-requests" className="block">
              <Card className="hover:bg-accent/5 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Leave Requests
                  </CardTitle>
                  <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingLeaveRequests}</div>
                  <p className="text-xs text-muted-foreground">
                    pending leave requests
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Employees
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalEmployees}</div>
                <p className="text-xs text-muted-foreground">
                  active employees in branch
                </p>
              </CardContent>
            </Card>
          </>
        )}
        {session.user.role === "HR" && (
          <DashboardStats stats={stats} userRole={session.user.role} />
        )}
      </div>
    </div>
  );
} 