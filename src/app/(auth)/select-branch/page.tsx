import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BranchSelector } from "@/components/branch/branch-selector";
import {Branch} from "@/models/models";

export default async function SelectBranchPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // For BRANCH_MANAGER, automatically select their managed branch and redirect
  // @ts-expect-error - branchId is not in the User type
  const role = session.user.role
  if (role === "BRANCH_MANAGER") {
    const user = await prisma.user.findUnique({
      // @ts-expect-error - branchId is not in the User type
      where: { id: session.user.id },
      select: {
        managedBranchId: true,
      },
    });

    if (user?.managedBranchId) {
      // Update user's selected branch
      await prisma.user.update({
        // @ts-expect-error - branchId is not in the User type
        where: { id: session.user.id },
        data: { selectedBranchId: user.managedBranchId },
      });
      
      // Redirect to dashboard
      redirect("/dashboard");
    }

    // If no managed branch, redirect to dashboard
    redirect("/dashboard");
  }

  // For MANAGEMENT, get all branches
  if (role === "MANAGEMENT") {
    const branches = await prisma.branch.findMany({
      orderBy: { name: "asc" },
    }) as Branch[];

    return <BranchSelector branches={branches} userRole={role} />;
  }

  // Other roles shouldn't access this page
  redirect("/dashboard");
} 
