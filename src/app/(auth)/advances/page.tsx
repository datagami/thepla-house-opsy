import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AdvancesManagement } from "@/components/advances/advances-management";

export const metadata: Metadata = {
  title: "Advances - HRMS",
  description: "View and manage employee salary advances",
};

export default async function AdvancesPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  // @ts-expect-error - role is not in the User type
  const userRole = session.user.role;
  const userId = session.user.id as string;

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <AdvancesManagement userRole={userRole} userId={userId} />
    </div>
  );
}
