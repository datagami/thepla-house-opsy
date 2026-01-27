import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WarningsManagementPage } from "@/components/warnings/warnings-management-page";

export const metadata: Metadata = {
  title: "Warnings Management - HRMS",
  description: "Manage and view all employee warnings",
};

export default async function WarningsPage() {
  const session = await auth();

  //@ts-expect-error - We check for HR/MANAGEMENT/BRANCH_MANAGER role
  if (!session?.user || !["HR", "MANAGEMENT", "BRANCH_MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  // Fetch branches and warning types for filters
  const [branches, warningTypes] = await Promise.all([
    prisma.branch.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.warningType.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  //@ts-expect-error - role is not in the User type
  const userRole = session.user.role;

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <WarningsManagementPage 
        branches={branches} 
        warningTypes={warningTypes}
        userRole={userRole}
      />
    </div>
  );
}
