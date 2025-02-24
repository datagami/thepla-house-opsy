import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BranchSelector } from "@/components/branch/branch-selector";

export default async function SelectBranchPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // For BRANCH_MANAGER, get their assigned branch
  if (session.user.role === "BRANCH_MANAGER") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { managedBranch: true },
    });

    if (!user?.managedBranch) {
      // If branch manager has no branch assigned, redirect to dashboard
      redirect("/dashboard");
    }

    return <BranchSelector 
      branches={[user.managedBranch]} 
      userRole={session.user.role} 
    />;
  }

  // For MANAGEMENT, get all branches
  if (session.user.role === "MANAGEMENT") {
    const branches = await prisma.branch.findMany({
      orderBy: { name: "asc" },
    });
    console.log(branches);

    return <BranchSelector branches={branches} userRole={session.user.role} />;
  }

  // Other roles shouldn't access this page
  redirect("/dashboard");
} 
