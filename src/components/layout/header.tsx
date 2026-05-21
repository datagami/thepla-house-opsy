import { auth } from "@/auth";
import { NavWrapper } from "./nav-wrapper";
import { prisma } from "@/lib/prisma";

export async function Header() {
  const session = await auth();

  if (!session?.user) return null;

  // @ts-expect-error - We check for role
  const role = session.user.role;
  // @ts-expect-error - We check for branchId
  const branchId = session.user.branchId;
  // @ts-expect-error - numId from session
  const numId = session.user.numId as number | null | undefined;
  const image = session.user.image as string | null | undefined;

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
        id: session.user.id ?? "",
        name: session.user.name,
        email: session.user.email,
        role: role,
        numId: numId ?? null,
        image: image ?? null,
      }}
      branchName={branchName || ""}
      userRole={role}
    />
  );
}
