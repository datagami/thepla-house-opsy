import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";

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

    // Get pending attendance verifications (only for previous days)
    const pendingVerifications = await prisma.attendance.count({
      where: {
        status: "PENDING",
        date: {
          lt: today, // Only count previous days
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
        <DashboardStats stats={stats} userRole={session.user.role} />
      </div>
    </div>
  );
} 