import Link from "next/link";
import { BranchSwitcher } from "@/components/branch/branch-switcher";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserNav } from "../layout/user-nav";
import {Branch, User} from "@/models/models";

export async function TopNav() {
  const session = await auth();

  let branches: Branch[] = [];
  let currentBranch = null;
  // @ts-expect-error - We check for role
  const role = session.user.role;

  //@ts-expect-error - We check for branchId
  const branchId = session.user.branchId;
  if (session?.user) {

    if (role === "MANAGEMENT") {
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
      }) as Branch[];

      currentBranch = user?.selectedBranch;
      // @ts-expect-error - We check for branchId
    } else if (role=== "BRANCH_MANAGER" && session.user.managedBranchId) {
      // Get managed branch details for branch manager
      currentBranch = await prisma.branch.findUnique({
        // @ts-expect-error - We check for managedBranchId
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
              {role === "BRANCH_MANAGER" && " (Managing)"}
            </span>
          )}
        </Link>
        <div className="ml-auto flex items-center space-x-4">
          {role === "MANAGEMENT" && (
            <BranchSwitcher 
              branches={branches} 
              currentBranchId={branchId}
            />
          )}
          <UserNav 
            user={{
              ...session?.user as User,
            }}
            branchName={currentBranch?.name || ''}
          />
        </div>
      </div>
    </div>
  );
} 
