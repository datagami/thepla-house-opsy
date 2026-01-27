import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-control";
import { WarningsPage } from "@/components/users/warnings-page";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function UserWarningsPage({ params }: Props) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    redirect("/login");
  }

  // @ts-expect-error role is in session
  const role = session.user.role as string;
  const isOwnProfile = session.user.id === id;
  // @ts-expect-error - role is not defined in the session type
  const canManageUsers = hasAccess(session.user.role, "users.manage");

  // Fetch user first to check branch access for branch managers
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, branchId: true, branch: { select: { id: true } } },
  });

  if (!user) {
    redirect("/404");
  }

  // Branch manager can access users in their (managed) branch
  const isBranchManagerForUser =
    role === "BRANCH_MANAGER" &&
    // @ts-expect-error branchId/managedBranchId in session
    ((session.user.managedBranchId && session.user.managedBranchId === user.branch?.id) ||
      // @ts-expect-error branchId in session
      (session.user.branchId && session.user.branchId === user.branch?.id));

  // Check access: must be own profile, have manage users permission, or be branch manager for this user
  if (!canManageUsers && !isOwnProfile && !isBranchManagerForUser) {
    redirect("/dashboard");
  }

  const canRegister = ["HR", "MANAGEMENT", "BRANCH_MANAGER"].includes(role) && (canManageUsers || isBranchManagerForUser);
  const canArchive = ["HR", "MANAGEMENT", "BRANCH_MANAGER"].includes(role) && (canManageUsers || isBranchManagerForUser);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <WarningsPage userId={id} userName={user.name} canRegister={canRegister} canArchive={canArchive} />
    </div>
  );
}

