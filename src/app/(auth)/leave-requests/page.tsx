import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LeaveRequestTable } from "@/components/leave-requests/leave-request-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata: Metadata = {
  title: "Leave Requests - HRMS",
  description: "Manage leave requests",
};

export default async function LeaveRequestsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  let leaveRequests;

  if (session.user.role === "EMPLOYEE") {
    // Get own leave requests
    leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        userId: session.user.id,
      },
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
        createdAt: "desc",
      },
    });
  } else if (session.user.role === "BRANCH_MANAGER") {
    // Get leave requests from branch employees
    leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        user: {
          branchId: session.user.branchId,
        },
      },
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
        createdAt: "desc",
      },
    });
  } else {
    // HR and Management can see all leave requests
    leaveRequests = await prisma.leaveRequest.findMany({
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
        createdAt: "desc",
      },
    });
  }

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
          leaveRequests={leaveRequests}
          userRole={session.user.role}
        />
      </div>
    </div>
  );
} 