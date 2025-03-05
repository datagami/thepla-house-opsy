import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UserProfileForm } from "@/components/users/user-profile-form";
import { hasAccess } from "@/lib/access-control";
import {Branch} from "@/models/models";

export const metadata: Metadata = {
  title: "Create User - HRMS",
  description: "Create a new user",
};

export default async function CreateUserPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/login");
  }

  // Check if user has permission to create users
  // @ts-expect-error - role is not defined in the session type
  const canManageUsers = hasAccess(session.user.role, "users.manage");

  if (!canManageUsers) {
    redirect("/dashboard");
  }

  const branches = await prisma.branch.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: 'asc',
    },
  }) as Branch[];

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Create New User</h2>
      </div>

      <div className="grid gap-6">
        <UserProfileForm branches={branches} />
      </div>
    </div>
  );
} 
