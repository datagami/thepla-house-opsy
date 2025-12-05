import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DepartmentTable } from "@/components/departments/department-table";
import { CreateDepartmentButton } from "@/components/departments/create-department-button";

export const metadata: Metadata = {
  title: "Department Management - HRMS",
  description: "Manage departments in the HRMS system",
};

export default async function DepartmentsPage() {
  const session = await auth();

  //@ts-expect-error - We check for HR/MANAGEMENT role
  if (!session?.user || !["HR", "MANAGEMENT"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const departments = await prisma.department.findMany({
    include: {
      _count: {
        select: {
          users: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Department Management</h2>
        <CreateDepartmentButton />
      </div>
      <DepartmentTable departments={departments} />
    </div>
  );
}

