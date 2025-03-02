import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EmployeeTable } from "@/components/employees/employee-table";

export const metadata: Metadata = {
  title: "Employees - HRMS",
  description: "Manage branch employees",
};

export default async function EmployeesPage() {
  const session = await auth();

  if (!session || session.user.role !== "BRANCH_MANAGER") {
    redirect("/dashboard");
  }

  const employees = await prisma.user.findMany({
    where: {
      // @ts-expect-error - branchId is not in the User type
      branchId: session.user.branchId,
      role: "EMPLOYEE",
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      _count: {
        select: {
          attendance: {
            where: {
              isPresent: true,
            },
          },
          leaveRequests: {
            where: {
              status: "APPROVED",
            },
          },
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
        <h2 className="text-3xl font-bold tracking-tight">Branch Employees</h2>
      </div>

      <div className="rounded-md border">
        <EmployeeTable employees={employees} />
      </div>
    </div>
  );
} 
