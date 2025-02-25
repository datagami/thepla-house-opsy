import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AttendanceVerificationTable } from "@/components/attendance/attendance-verification-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Attendance Verification - HRMS",
  description: "Verify employee attendance records",
};

function LoadingStats() {
  return (
    <div className="grid gap-4 md:grid-cols-7">
      {Array(7).fill(0).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-8 w-12 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default async function AttendanceVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  

  if (!session || session.user.role !== "HR") {
    redirect("/dashboard");
  }

  // Default to PENDING if no status is specified
  const status = (await searchParams).status || "PENDING";

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  console.log(status);

  // Build where clause based on status
  const whereClause = {
    date: {
      gte: today,
      lt: tomorrow,
    },
    ...(status !== "ALL" && {
      status: {
        equals: status,
      },
    }),
  };

  const attendanceRecords = await prisma.attendance.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          name: true,
          branch: {
            select: {
              name: true,
            },
          },
        },
      },
      verifiedBy: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [
      { date: "desc" },
    ],
  });

  // Get total counts for all statuses for today
  const allAttendance = await prisma.attendance.groupBy({
    by: ['status'],
    where: {
      date: {
        gte: today,
        lt: tomorrow,
      },
    },
    _count: {
      status: true,
    },
  });

  // Calculate statistics
  const stats = {
    total: attendanceRecords.length,
    pending: allAttendance.find(a => a.status === "PENDING")?._count.status || 0,
    approved: allAttendance.find(a => a.status === "APPROVED")?._count.status || 0,
    rejected: allAttendance.find(a => a.status === "REJECTED")?._count.status || 0,
    present: attendanceRecords.filter(r => r.isPresent).length,
    absent: attendanceRecords.filter(r => !r.isPresent).length,
    halfDay: attendanceRecords.filter(r => r.isHalfDay).length,
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Attendance Verification</h2>

      <Suspense fallback={<LoadingStats />}>
        <div className="grid gap-4 md:grid-cols-7">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{stats.approved}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Present</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.present}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Absent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Half Day</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.halfDay}</div>
            </CardContent>
          </Card>
        </div>
      </Suspense>

      <div className="rounded-md border">
        <AttendanceVerificationTable 
          records={attendanceRecords}
          currentStatus={status}
        />
      </div>
    </div>
  );
} 