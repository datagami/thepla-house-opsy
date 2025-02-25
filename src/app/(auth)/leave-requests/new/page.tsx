import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { NewLeaveRequestForm } from "@/components/leave-requests/new-leave-request-form";

export const metadata: Metadata = {
  title: "New Leave Request - HRMS",
  description: "Submit a new leave request",
};

export default async function NewLeaveRequestPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">New Leave Request</h2>
      <div className="mx-auto max-w-2xl">
        <NewLeaveRequestForm />
      </div>
    </div>
  );
} 