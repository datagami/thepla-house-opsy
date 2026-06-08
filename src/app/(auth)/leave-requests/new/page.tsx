import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { NewLeaveRequestForm } from "@/components/leave-requests/new-leave-request-form";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "New Leave Request - HRMS",
  description: "Submit a new leave request",
};

export default async function NewLeaveRequestPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // @ts-expect-error - role is not in the User type
  const role = session.user.role as string;

  if (!["EMPLOYEE", "BRANCH_MANAGER", "HR", "MANAGEMENT"].includes(role)) {
    redirect("/leave-requests");
  }

  type EmployeeOption = {
    id: string;
    name: string | null;
    departmentName: string | null;
    branchName: string | null;
  };
  let employees: EmployeeOption[] = [];

  if (role === "BRANCH_MANAGER") {
    // @ts-expect-error - branchId is not in the User type
    const branchId = (session.user.branchId as string | undefined) ?? undefined;
    if (!branchId) {
      redirect("/leave-requests");
    }

    const rows = await prisma.user.findMany({
      where: { branchId, role: "EMPLOYEE", status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        department: { select: { name: true } },
        branch: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    employees = rows.map((e) => ({
      id: e.id,
      name: e.name ?? null,
      departmentName: e.department?.name ?? null,
      branchName: e.branch?.name ?? null,
    }));
  } else if (role === "HR" || role === "MANAGEMENT") {
    // HR and MANAGEMENT can file on behalf of any ACTIVE user across all
    // branches (including other managers / HR colleagues). Exclude the
    // session user themselves — the form has a separate "Myself" option,
    // and including them again created a confusing duplicate.
    // @ts-expect-error - id is not in the User type
    const sessionUserId = session.user.id as string | undefined;
    const rows = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        ...(sessionUserId ? { id: { not: sessionUserId } } : {}),
      },
      select: {
        id: true,
        name: true,
        department: { select: { name: true } },
        branch: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    employees = rows.map((e) => ({
      id: e.id,
      name: e.name ?? null,
      departmentName: e.department?.name ?? null,
      branchName: e.branch?.name ?? null,
    }));
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">New Leave Request</h2>
      <div className="mx-auto max-w-2xl">
        <NewLeaveRequestForm userRole={role} employees={employees} />
      </div>
    </div>
  );
}