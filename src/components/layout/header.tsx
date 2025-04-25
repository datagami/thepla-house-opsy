import { auth } from "@/auth";
import { NavWrapper } from "./nav-wrapper";
import { prisma } from "@/lib/prisma";
import {User} from "@/models/models";

export async function Header() {
  const session = await auth();

  if (!session?.user) return null;

  // @ts-expect-error - We check for role
  const role = session.user.role;
  // @ts-expect-error - We check for branchId
  const branchId = session.user.branchId

  let branchName = null;
  if (session.user) {
    if (role === "BRANCH_MANAGER") {
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
    } else if (branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { name: true },
      });
      branchName = branch?.name;
    }
  }

  return (
    <NavWrapper 
      user={{
        role: role,
        name: session.user.name,
        email: session.user.email,
      } as User}
      branchName={branchName || ""}
      userRole={role}
    />
  );
} 
