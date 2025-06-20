import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasAccess } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import {Salary} from "@/models/models";

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
    where: { userId },
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
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left">Month</th>
              <th className="px-4 py-2 text-left">Year</th>
              <th className="px-4 py-2 text-left">Net Salary</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Created At</th>
            </tr>
          </thead>
          <tbody>
            {salaries.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-4">No payslips found.</td>
              </tr>
            ) : (
              salaries.map((salary) => (
                <tr key={salary.id} className="border-b">
                  <td className="px-4 py-2">{salary.month}</td>
                  <td className="px-4 py-2">{salary.year}</td>
                  <td className="px-4 py-2">₹{salary.netSalary.toLocaleString()}</td>
                  <td className="px-4 py-2">{salary.status}</td>
                  <td className="px-4 py-2">{new Date(salary.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
} 
