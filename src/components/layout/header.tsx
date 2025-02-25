import { auth } from "@/auth";
import { NavWrapper } from "./nav-wrapper";
import { prisma } from "@/lib/prisma";

export async function Header() {
  const session = await auth();

  if (!session?.user) return null;

  let branchName = null;
  if (session.user) {
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
    <NavWrapper 
      user={{
        role: session.user.role,
        name: session.user.name,
        email: session.user.email,
        branchName,
      }} 
    />
  );
} 