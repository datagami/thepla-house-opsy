import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LeaveRequestTable } from "@/components/leave/leave-request-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {LeaveRequest} from "@/models/models";

export const metadata: Metadata = {
  title: "Leave Requests - HRMS",
  description: "View and manage leave requests",
};

export default async function LeaveRequestsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Build query based on user role
  const queryOptions = {
    where: {},
    include: {
      user: {
        select: {
          name: true,
          branch: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc" as const,
    },
  };

  // Filter based on role
  if (session.user.role === "BRANCH_MANAGER") {
    queryOptions.where = {
      user: {
        // @ts-expect-error - branchId is not in the User type
        branchId: session.user.branchId,
      },
    };
  } else if (session.user.role === "EMPLOYEE") {
    queryOptions.where = {
      userId: session.user.id,
    };
  }
  // HR and MANAGEMENT can see all requests

  const leaveRequests = await prisma.leaveRequest.findMany(queryOptions) as LeaveRequest[];

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Leave Requests</h2>
        {session.user.role === "EMPLOYEE" && (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <LeaveRequestTable 
          requests={leaveRequests}
          showBranch={["HR", "MANAGEMENT"].includes(session.user.role)}
          userRole={session.user.role}
        />
      </div>
    </div>
  );
} 
