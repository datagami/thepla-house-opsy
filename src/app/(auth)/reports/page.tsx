import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ReportsDashboard } from "@/components/reports/reports-dashboard";

export const metadata: Metadata = {
  title: "Reports - HRMS",
  description: "Comprehensive reports and analytics",
};

export default async function ReportsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // @ts-expect-error - role is not in the User type
  const role = session.user.role;

  // Check if user has access to reports
  if (!["HR", "MANAGEMENT", "BRANCH_MANAGER"].includes(role)) {
    redirect("/dashboard");
  }

  return <ReportsDashboard userRole={role} />;
}

