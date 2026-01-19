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

  if (!["EMPLOYEE", "BRANCH_MANAGER"].includes(role)) {
    redirect("/leave-requests");
  }

  let branchEmployees: Array<{ id: string; name: string | null; departmentName: string | null }> = [];
  if (role === "BRANCH_MANAGER") {
    // @ts-expect-error - branchId is not in the User type
    const branchId = (session.user.branchId as string | undefined) ?? undefined;
    if (!branchId) {
      redirect("/leave-requests");
    }

    const employees = await prisma.user.findMany({
      where: { branchId, role: "EMPLOYEE", status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        department: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    branchEmployees = employees.map((e) => ({
      id: e.id,
      name: e.name ?? null,
      departmentName: e.department?.name ?? null,
    }));
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">New Leave Request</h2>
      <div className="mx-auto max-w-2xl">
        <NewLeaveRequestForm userRole={role} employees={branchEmployees} />
      </div>
    </div>
  );
} 