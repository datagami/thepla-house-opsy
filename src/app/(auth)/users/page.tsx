import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UserTable } from "@/components/users/user-table";
import {Branch, User} from "@/models/models";

export const metadata: Metadata = {
  title: "User Management - HRMS",
  description: "Manage users1 in the HRMS system",
};

export default async function UsersPage() {
  const session = await auth();

  //@ts-expect-error - We check for HR and MANAGEMENT roles
  const role = session.user.role;
  if (!session || !["HR", "MANAGEMENT"].includes(role)) {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      branch: {
        select: {
          name: true,
          id: true
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  }) as User[];

  const branches = await prisma.branch.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  }) as Branch[];

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Users</h2>
      </div>
      <div className="space-y-4">
        <UserTable 
          users={users}
          branches={branches}
          currentUserRole={role}
        />
      </div>
    </div>
  );
} 
