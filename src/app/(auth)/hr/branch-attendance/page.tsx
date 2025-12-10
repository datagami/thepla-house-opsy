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
          department: {
            select: {
              id: true,
              name: true,
            },
          },
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

      // Calculate statistics from employees array (what's actually displayed)
      // This ensures we count unique employees, not duplicate attendance records
      const employeesWithAttendance = employees.filter(emp => emp.attendance.length > 0);
      const submitted = employeesWithAttendance.length;
      const notAdded = totalEmployees - submitted;
      
      // Calculate present/absent from employees with attendance
      const present = employeesWithAttendance.filter(
        (emp) => emp.attendance[0]?.isPresent === true
      ).length;
      const absent = employeesWithAttendance.filter(
        (emp) => emp.attendance[0]?.isPresent === false
      ).length;
      
      // Calculate status-based statistics from employees with attendance
      const pending = employeesWithAttendance.filter(
        (emp) => emp.attendance[0]?.status === "PENDING_VERIFICATION"
      ).length;
      const approved = employeesWithAttendance.filter(
        (emp) => emp.attendance[0]?.status === "APPROVED"
      ).length;
      const rejected = employeesWithAttendance.filter(
        (emp) => emp.attendance[0]?.status === "REJECTED"
      ).length;
      const halfDay = employeesWithAttendance.filter(
        (emp) => emp.attendance[0]?.isHalfDay === true
      ).length;

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
    <div className="flex-1 space-y-2 md:space-y-4 p-3 sm:p-6 lg:p-8 pt-3 sm:pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight">
            Branch Attendance Submissions
          </h2>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-0.5 md:mt-1">
            View attendance submission status across all branches
          </p>
        </div>
      </div>

      <Suspense fallback={<LoadingTable />}>
        <BranchAttendanceSubmissions
          branchStats={branchStats}
          selectedDate={selectedDate}
        />
      </Suspense>
    </div>
  );
}

