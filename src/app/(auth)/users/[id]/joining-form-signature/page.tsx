import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { JoiningFormESignature } from "@/components/users/joining-form-esignature";
import { hasAccess } from "@/lib/access-control";
import { notFound } from "next/navigation";
import { User } from "@/models/models";
import { userIdentitySelect } from "@/lib/select-presets";
import { EmployeeIdentity } from "@/components/ui/employee-identity";

export const metadata: Metadata = {
  title: "Appointment Letter E-Signature - HRMS",
  description: "Sign your appointment letter digitally",
};

interface JoiningFormSignaturePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function JoiningFormSignaturePage({ params }: JoiningFormSignaturePageProps) {
  const session = await auth();
  const { id } = await params;
  
  if (!session?.user) {
    redirect("/login");
  }

  // Get the user to be signed
  const user = await prisma.user.findUnique({
    where: { id: id },
    select: {
      ...userIdentitySelect,
      branch: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      joiningFormSignedAt: true,
    },
  });

  if (!user) {
    notFound();
  }

  // Check if user has already signed
  if (user.joiningFormSignedAt) {
    redirect(`/users/${user.id}?message=already-signed`);
  }

  // Check permissions - user can sign their own form or HR/Management can sign for others
  const isOwnForm = session.user.id === user.id;
  // @ts-expect-error - role is not defined in the session type
  const canManageUsers = hasAccess(session.user.role, "users.manage");

  if (!isOwnForm && !canManageUsers) {
    redirect("/dashboard");
  }

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between">
        {isOwnForm ? (
          <h2 className="text-3xl font-bold tracking-tight">Sign Your Appointment Letter</h2>
        ) : (
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Sign Appointment Letter</h2>
            <EmployeeIdentity user={user} size="md" />
          </div>
        )}
      </div>

      <JoiningFormESignature user={user as unknown as User} />
    </div>
  );
} 
