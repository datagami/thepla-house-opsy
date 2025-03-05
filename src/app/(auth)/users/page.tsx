import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UserTable } from "@/components/users/user-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { hasAccess } from "@/lib/access-control";
import {Branch, User} from "@/models/models";
export const metadata: Metadata = {
  title: "Users - HRMS",
  description: "Manage users in the system",
};

export default async function UsersPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/login");
  }

  // @ts-expect-error - role is not defined in the session type
  const role = session.user.role
  const canManageUsers = hasAccess(role, "users.manage");

  if (!canManageUsers) {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    include: {
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  }) as User[];

  const branches = await prisma.branch.findMany({
    select: {
      id: true,
      name: true,
    },
  }) as Branch[];

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Users</h2>
        <Link href="/users/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </Link>
      </div>

      <UserTable users={users} branches={branches} currentUserRole={role} canEdit={canManageUsers} />
    </div>
  );
} 
