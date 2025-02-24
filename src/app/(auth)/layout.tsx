import { redirect } from "next/navigation";
import { auth } from "@/auth"
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
