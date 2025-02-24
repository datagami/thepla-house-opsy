import { auth } from "@/auth";
import { MainNav } from "@/components/layout/main-nav";
import { UserNav } from "@/components/layout/user-nav";
import { prisma } from "@/lib/prisma";

export async function Header() {
  const session = await auth();

  let branchName = null;
  if (session?.user) {
    if (session.user.role === "BRANCH_MANAGER") {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          managedBranch: {
            select: {
              name: true,
            },
          },
        },
      });
      branchName = user?.managedBranch?.name;
    } else if (session.user.branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: session.user.branchId },
        select: { name: true },
      });
      branchName = branch?.name;
    }
  }

  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <MainNav />
        <div className="ml-auto flex items-center space-x-4">
          {session?.user && (
            <UserNav
              user={{
                name: session.user.name,
                email: session.user.email,
                role: session.user.role,
                branchName,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
} 