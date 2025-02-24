import Link from "next/link";
import { BranchSwitcher } from "@/components/branch/branch-switcher";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserNav } from "../layout/user-nav";

export async function TopNav() {
  const session = await auth();

  let branches = [];
  let currentBranch = null;

  if (session?.user) {
    if (session.user.role === "MANAGEMENT") {
      // Get all branches and current user's selected branch
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          selectedBranch: true,
        },
      });

      // Get all branches
      branches = await prisma.branch.findMany({
        orderBy: { name: "asc" },
      });

      currentBranch = user?.selectedBranch;
    } else if (session.user.role === "BRANCH_MANAGER" && session.user.managedBranchId) {
      // Get managed branch details for branch manager
      currentBranch = await prisma.branch.findUnique({
        where: { id: session.user.managedBranchId },
      });
    }
  }

  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <Link href="/dashboard" className="font-semibold">
          HRMS Dashboard
          {currentBranch && (
            <span className="text-muted-foreground ml-2 text-sm">
              {currentBranch.name}
              {session.user.role === "BRANCH_MANAGER" && " (Managing)"}
            </span>
          )}
        </Link>
        <div className="ml-auto flex items-center space-x-4">
          {session?.user.role === "MANAGEMENT" && (
            <BranchSwitcher 
              branches={branches} 
              currentBranchId={session.user.branchId} 
            />
          )}
          <UserNav 
            user={{
              ...session?.user,
              branchName: currentBranch?.name
            }} 
          />
        </div>
      </div>
    </div>
  );
} 