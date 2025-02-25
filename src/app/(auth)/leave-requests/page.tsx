import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LeaveRequestContent } from "@/components/leave-requests/leave-request-content";

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

  return <LeaveRequestContent leaveRequests={leaveRequests} userRole={session.user.role} />;
} 