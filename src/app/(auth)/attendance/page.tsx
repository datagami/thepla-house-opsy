import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AttendanceCalendar } from "@/components/attendance/attendance-calendar";

export const metadata: Metadata = {
  title: "Attendance Management - HRMS",
  description: "Manage attendance in the HRMS system",
};

export default async function AttendancePage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  let users = [];

  if (session.user.role === "BRANCH_MANAGER") {
    // Get users from managed branch
    users = await prisma.user.findMany({
      where: {
        branchId: session.user.branchId,
        role: "EMPLOYEE",
      },
      select: {
        id: true,
        name: true,
        attendance: {
          where: {
            date: {
              gte: firstDayOfMonth,
              lte: lastDayOfMonth,
            },
          },
        },
      },
    });
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Attendance Management</h2>
      </div>
      <AttendanceCalendar users={users} />
    </div>
  );
} 