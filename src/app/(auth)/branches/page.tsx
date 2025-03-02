import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BranchTable } from "@/components/branches/branch-table";
import { CreateBranchButton } from "@/components/branches/create-branch-button";

export const metadata: Metadata = {
  title: "Branch Management - HRMS",
  description: "Manage branches in the HRMS system",
};

export default async function BranchesPage() {
  const session = await auth();

  //@ts-expect-error - We check for MANAGEMENT role
  if (!session || session.user.role !== "MANAGEMENT") {
    redirect("/dashboard");
  }

  const branches = await prisma.branch.findMany({
    include: {
      _count: {
        select: {
          users: true,
          managers: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Branch Management</h2>
        <CreateBranchButton />
      </div>
      <BranchTable branches={branches} />
    </div>
  );
} 
