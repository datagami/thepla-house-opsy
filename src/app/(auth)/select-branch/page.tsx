import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BranchSelector } from "@/components/branch/branch-selector";

export default async function SelectBranchPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // For BRANCH_MANAGER, automatically select their managed branch and redirect
  if (session.user.role === "BRANCH_MANAGER") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        managedBranchId: true,
      },
    });

    if (user?.managedBranchId) {
      // Update user's selected branch
      await prisma.user.update({
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
  if (session.user.role === "MANAGEMENT") {
    const branches = await prisma.branch.findMany({
      orderBy: { name: "asc" },
    });

    return <BranchSelector branches={branches} userRole={session.user.role} />;
  }

  // Other roles shouldn't access this page
  redirect("/dashboard");
} 
