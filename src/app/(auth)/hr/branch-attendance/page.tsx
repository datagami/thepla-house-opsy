import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BranchAttendanceSubmissions } from "@/components/attendance/branch-attendance-submissions";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Branch Attendance Submissions - HRMS",
  description: "View branch-wise attendance submissions",
};

function LoadingTable() {
  return (
    <div className="rounded-md border">
      <div className="p-8">
        <div className="space-y-4">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function BranchAttendancePage({
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

  const { date } = await searchParams;
  
  // Get the date from query params or use today
  const selectedDate = date ? new Date(date) : new Date();
  selectedDate.setHours(0, 0, 0, 0);
  
  // Get end of selected day
  const nextDay = new Date(selectedDate);
  nextDay.setDate(nextDay.getDate() + 1);

  // Get all branches with their employee counts
  const branches = await prisma.branch.findMany({
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      _count: {
        select: {
          users: {
            where: {
              role: "EMPLOYEE",
              status: "ACTIVE",
            },
          },
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  // Get attendance statistics per branch for the selected date
  const branchStats = await Promise.all(
    branches.map(async (branch) => {
      // Get total employees in branch
      const totalEmployees = branch._count.users;

      // Get all employees in this branch
      const employees = await prisma.user.findMany({
        where: {
          branchId: branch.id,
          role: "EMPLOYEE",
          status: "ACTIVE",
        },
        select: {
          id: true,
          name: true,
          department: true,
          attendance: {
            where: {
              date: {
                gte: selectedDate,
                lt: nextDay,
              },
            },
            select: {
              id: true,
              status: true,
              isPresent: true,
              isHalfDay: true,
              overtime: true,
              checkIn: true,
              checkOut: true,
              shift1: true,
              shift2: true,
              shift3: true,
              notes: true,
            },
            take: 1,
          },
        },
        orderBy: {
          name: "asc",
        },
      });

      // Get attendance records for statistics
      const attendanceRecords = await prisma.attendance.findMany({
        where: {
          branchId: branch.id,
          date: {
            gte: selectedDate,
            lt: nextDay,
          },
        },
        select: {
          status: true,
          isPresent: true,
          isHalfDay: true,
        },
      });

      // Calculate statistics
      const submitted = attendanceRecords.length;
      const pending = attendanceRecords.filter(
        (a) => a.status === "PENDING_VERIFICATION"
      ).length;
      const approved = attendanceRecords.filter(
        (a) => a.status === "APPROVED"
      ).length;
      const rejected = attendanceRecords.filter(
        (a) => a.status === "REJECTED"
      ).length;
      const present = attendanceRecords.filter((a) => a.isPresent).length;
      const absent = attendanceRecords.filter((a) => !a.isPresent).length;
      const halfDay = attendanceRecords.filter((a) => a.isHalfDay).length;
      const notAdded = totalEmployees - submitted;

      const completionPercentage =
        totalEmployees > 0
          ? Math.round((submitted / totalEmployees) * 100)
          : 0;

      return {
        branchId: branch.id,
        branchName: branch.name,
        location: `${branch.city}, ${branch.state}`,
        totalEmployees,
        submitted,
        pending,
        approved,
        rejected,
        present,
        absent,
        halfDay,
        notAdded,
        completionPercentage,
        employees,
      };
    })
  );

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Branch Attendance Submissions
          </h2>
          <p className="text-muted-foreground">
            View attendance submission status across all branches
          </p>
        </div>
      </div>

      <Suspense fallback={<LoadingTable />}>
        <BranchAttendanceSubmissions
          branchStats={branchStats}
          selectedDate={selectedDate}
          userRole={role}
        />
      </Suspense>
    </div>
  );
}

