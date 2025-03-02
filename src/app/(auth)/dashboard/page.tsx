import {Metadata} from "next";
import {auth} from "@/auth";
import {redirect} from "next/navigation";
import {prisma} from "@/lib/prisma";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Clock, CalendarCheck, Users, AlertCircle} from "lucide-react";
import Link from "next/link";
import {Attendance} from "@/models/models";

export const metadata: Metadata = {
  title: "Dashboard - HRMS",
  description: "Example dashboard page",
};

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  let stats: {
    totalEmployees?: number;
    markedAttendance?: number;
    pendingAttendance?: number;
    pendingLeaveRequests?: number;
    pendingManagerAttendance?: number;
    pendingVerifications?: number;
    pendingApprovals?: number;
    rejectedAttendance?: Attendance[];
    rejectedAttendanceCount?: number;
  } = {
    totalEmployees: 0,
    markedAttendance: 0,
    pendingAttendance: 0,
    pendingLeaveRequests: 0,
    pendingManagerAttendance: 0,
    pendingVerifications: 0,
    pendingApprovals: 0,
    rejectedAttendance: [],
    rejectedAttendanceCount: 0
  };

  // @ts-expect-error - role is not in the User type
  const role = session.user.role

  if (role === "BRANCH_MANAGER") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get total employees in branch
    const totalEmployees = await prisma.user.count({
      where: {
        // @ts-expect-error - branchId is not in the User type
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
          // @ts-expect-error - branchId is not in the User type
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
          // @ts-expect-error - branchId is not in the User type
          branchId: session.user.branchId,
        },
      },
    });

    // Get rejected attendance records for the branch
    const rejectedAttendance = await prisma.attendance.findMany({
      where: {
        status: "REJECTED",
        user: {
          // @ts-expect-error - branchId is not in the User
          branchId: session.user.branchId,
        },
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    }) as Attendance[];

    stats = {
      totalEmployees,
      markedAttendance,
      pendingAttendance: totalEmployees - markedAttendance,
      pendingLeaveRequests,
      rejectedAttendance
    };
  }

  // @ts-expect-error - role is not in the User type
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

    // Get pending attendance verifications - updated query
    const pendingVerifications = await prisma.attendance.count({
      where: {
        AND: [
          { status: "PENDING" },
          {
            user: {
              NOT: {
                status: "INACTIVE",
              },
            },
          },
        ],
      },
    });

    // Get pending user approvals
    const pendingApprovals = await prisma.user.count({
      where: {
        status: "PENDING",
      },
    });

    // Get rejected attendance count
    const rejectedAttendanceCount = await prisma.attendance.count({
      where: {
        status: "REJECTED",
      },
    });

    stats = {
      pendingManagerAttendance,
      pendingVerifications,
      pendingApprovals,
      rejectedAttendanceCount,
    };
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {role === "BRANCH_MANAGER" && (
          <>
            <Link href="/attendance" className="block">
              <Card className="hover:bg-accent/5 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Pending Attendance
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingAttendance}</div>
                  <p className="text-xs text-muted-foreground">
                    employees haven&#39;t marked attendance today
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
                  <CalendarCheck className="h-4 w-4 text-muted-foreground"/>
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
                <Users className="h-4 w-4 text-muted-foreground"/>
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
        {role === "HR" && (
          <>
            <Link href="/hr/attendance-verification" className="block">
              <Card className="hover:bg-accent/5 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Pending Verifications
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingVerifications}</div>
                  <p className="text-xs text-muted-foreground">
                    attendance records need verification
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/hr/users" className="block">
              <Card className="hover:bg-accent/5 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Pending Approvals
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingApprovals}</div>
                  <p className="text-xs text-muted-foreground">
                    new user registrations
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/hr/attendance" className="block">
              <Card className="hover:bg-accent/5 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Manager Attendance
                  </CardTitle>
                  <CalendarCheck className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingManagerAttendance}</div>
                  <p className="text-xs text-muted-foreground">
                    managers haven&#39;t marked attendance
                  </p>
                </CardContent>
              </Card>
            </Link>

            {stats.rejectedAttendance && stats.rejectedAttendance.length > 0 && (
              <Link href="/hr/attendance-verification?status=REJECTED" className="block">
                <Card className="hover:bg-accent/5 transition-colors">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Rejected Records
                    </CardTitle>
                    <AlertCircle className="h-4 w-4 text-red-500"/>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-500">{stats.rejectedAttendanceCount}</div>
                    <p className="text-xs text-muted-foreground">
                      attendance records rejected
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
