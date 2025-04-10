import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UserProfileForm } from "@/components/users/user-profile-form";
import { hasAccess } from "@/lib/access-control";
import {Branch, User} from "@/models/models";
import { AdvancePaymentForm } from "@/components/users/advance-payment-form";
import { AdvancePaymentsList } from "@/components/users/advance-payments-list";

export const metadata: Metadata = {
  title: "User Profile - HRMS",
  description: "View and edit user profile",
};

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function UserProfilePage({ params }: Props) {
  const session = await auth();
  const {id} = await params;
  
  if (!session?.user) {
    redirect("/login");
  }

  // Check if user has permission to view/edit other users
  // @ts-expect-error - role is not defined in the session type
  const canManageUsers = hasAccess(session.user.role, "users.manage");
  const isOwnProfile = session.user.id === id;

  if (!canManageUsers && !isOwnProfile) {
    redirect("/dashboard");
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
      references: {
        select: {
          id: true,
          name: true,
          contactNo: true
        },
      },
      accounts: true,
      sessions: true,
      attendance: true,
      leaveRequests: true,
      approvedBy: true,
      approvedUsers: true,
      verifiedAttendance: true,
      salaries: true,
      advances: true,
      approvedAdvances: true,
      approvedInstallments: true
    },
  }) as unknown as User;


  if (!user) {
    redirect("/404");
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
        <h2 className="text-3xl font-bold tracking-tight">User Profile</h2>
      </div>

      <div className="grid gap-6">
        <UserProfileForm 
          user={user} 
          branches={branches}
          canEdit={canManageUsers || isOwnProfile}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Advance Payments</h2>
          <AdvancePaymentForm userId={id} userName={user.name} />
        </div>
        <AdvancePaymentsList userId={id} />
      </div>
    </div>
  );
} 
