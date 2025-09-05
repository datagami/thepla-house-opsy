import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasAccess } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import PayslipTableClient from "./PayslipTableClient";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function PayslipsPage({ params }: Props) {
  const session = await auth();
  const { id: userId } = await params;

  if (!session?.user) {
    redirect("/login");
  }

  // @ts-expect-error - role is not defined in the session type
  const canManageUsers = hasAccess(session.user.role, "users.manage");
  const isOwnProfile = session.user.id === userId;

  if (!canManageUsers && !isOwnProfile) {
    redirect("/dashboard");
  }

  // Fetch salaries for this user
  
  const salaries = await prisma.salary.findMany({
    where: {
      userId,
      status: "PAID"
    },
    orderBy: [
      { year: "desc" },
      { month: "desc" },
    ],
    select: {
      id: true,
      month: true,
      year: true,
      netSalary: true,
      status: true,
      paidAt: true,
      createdAt: true,
    },
    take: 36,
  });

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Payslips</h2>
      </div>
      <div className="overflow-x-auto">
        <PayslipTableClient
          salaries={salaries.map(s => ({
            ...s,
            createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt
          }))}
        />
      </div>
    </div>
  );
} 
