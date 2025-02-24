import { redirect } from "next/navigation";
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma";
import { SideNav } from "@/components/dashboard/side-nav";
import { TopNav } from "@/components/dashboard/top-nav";

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
  if (session.user.role === "BRANCH_MANAGER") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { managedBranch: true },
    });

    if (user?.managedBranch && !session.user.branchId) {
      redirect("/select-branch");
    }
  }

  return (
    <div className="min-h-screen">
      <TopNav />
      <div className="flex h-[calc(100vh-4rem)]">
        <SideNav />
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
} 
