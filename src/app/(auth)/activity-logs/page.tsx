import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ActivityLogsView } from "@/components/activity-logs/activity-logs-view";

export const metadata: Metadata = {
  title: "Activity Logs - HRMS",
  description: "View all application activity logs",
};

export default async function ActivityLogsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // @ts-expect-error - role is not in the User type
  const role = session.user.role;

  // Only HR and MANAGEMENT can view activity logs
  if (!["HR", "MANAGEMENT"].includes(role)) {
    redirect("/dashboard");
  }

  return <ActivityLogsView />;
}
