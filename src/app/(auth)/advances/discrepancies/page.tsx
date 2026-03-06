import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AdvanceDiscrepancies } from "@/components/advances/advance-discrepancies";

export const metadata: Metadata = {
  title: "Advance Discrepancies - HRMS",
  description: "View and fix advance payment discrepancies caused by salary deletions",
};

export default async function AdvanceDiscrepanciesPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  // @ts-expect-error - role is not in the User type
  const userRole = session.user.role;

  if (!["HR", "MANAGEMENT"].includes(userRole)) {
    redirect("/advances");
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <AdvanceDiscrepancies />
    </div>
  );
}
