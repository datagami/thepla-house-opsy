import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WarningTypeTable } from "@/components/warning-types/warning-type-table";
import { CreateWarningTypeButton } from "@/components/warning-types/create-warning-type-button";

export const metadata: Metadata = {
  title: "Warning Types Management - HRMS",
  description: "Manage warning types in the HRMS system",
};

export default async function WarningTypesPage() {
  const session = await auth();

  //@ts-expect-error - We check for HR/MANAGEMENT role
  if (!session?.user || !["HR", "MANAGEMENT"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const warningTypes = await prisma.warningType.findMany({
    include: {
      _count: {
        select: {
          warnings: true,
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
        <h2 className="text-3xl font-bold tracking-tight">Warning Types Management</h2>
        <CreateWarningTypeButton />
      </div>
      <WarningTypeTable warningTypes={warningTypes} />
    </div>
  );
}
