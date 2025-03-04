import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AttendanceVerificationTable } from "@/components/attendance/attendance-verification-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";
import {Attendance} from "@/models/models";

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
  searchParams: Promise<{ status?: 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED' | 'ALL'; date?: string }>;
}) {
  const session = await auth();
  const {status, date} = await searchParams;
  
  // @ts-expect-error - We check for HR role
  if (!session || session.user.role !== "HR") {
    redirect("/dashboard");
  }

  // Default to PENDING if no status is specified

  // Get selected date or default to today
  const selectedStatus = status || "PENDING_VERIFICATION";
  const selectedDate = date ? 
    new Date(date) : 
    new Date();
  
  // Set time to start of day
  selectedDate.setHours(0, 0, 0, 0);
  
  // Get end of selected day
  const nextDay = new Date(selectedDate);
  nextDay.setDate(nextDay.getDate() + 1);

  // Build where clause based on status and date
  const whereClause = {
    date: {
      gte: selectedDate,
      lt: nextDay,
    },
    ...(selectedStatus !== "ALL" && {
      status: {
        equals: selectedStatus,
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
  }) as Attendance[];

  // Get total counts for selected date
  const allAttendance = await prisma.attendance.groupBy({
    by: ['status'],
    where: {
      date: {
        gte: selectedDate,
        lt: nextDay,
      },
    },
    _count: {
      status: true,
    },
  });

  // Calculate statistics
  const stats = {
    total: attendanceRecords.length,
    pending: allAttendance.find(a => a.status === "PENDING_VERIFICATION")?._count.status || 0,
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
          currentStatus={selectedStatus}
          currentDate={selectedDate}
        />
      </div>
    </div>
  );
} 
