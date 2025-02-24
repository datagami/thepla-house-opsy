import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AttendanceVerificationTable } from "@/components/hr/attendance-verification-table";

export const metadata: Metadata = {
  title: "Attendance Verification - HRMS",
  description: "Verify employee attendance records",
};

export default async function AttendanceVerificationPage() {
  const session = await auth();

  if (!session || session.user.role !== "HR") {
    redirect("/dashboard");
  }

  const pendingAttendance = await prisma.attendance.findMany({
    where: {
      status: "PENDING",
    },
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
    },
    orderBy: {
      date: "desc",
    },
  });

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Attendance Verification</h2>
      <AttendanceVerificationTable data={pendingAttendance} />
    </div>
  );
} 