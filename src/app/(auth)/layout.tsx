import { redirect } from "next/navigation";
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma";
import { SideNav } from "@/components/layout/side-nav";
import { Header } from "@/components/layout/header";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Only redirect branch managers to branch selection if they have an assigned branch
  // @ts-expect-error - branchId is not in the User type
  const role = session.user.role;
  if (role === "BRANCH_MANAGER") {
    const user = await prisma.user.findUnique({
      // @ts-expect-error - branchId is not in the User type
      where: { id: session.user.id },
      include: { managedBranch: true },
    });

    // @ts-expect-error - branchId is not in the User type
    if (user?.managedBranch && !session.user.branchId) {
      redirect("/select-branch");
    }
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex">
        <SideNav userRole={role} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
} 
