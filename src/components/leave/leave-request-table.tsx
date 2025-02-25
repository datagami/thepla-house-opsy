"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface LeaveRequest {
  id: string;
  startDate: Date;
  endDate: Date;
  leaveType: string;
  reason: string;
  status: string;
  user: {
    name: string;
    branch?: {
      name: string;
    } | null;
  };
}

interface LeaveRequestTableProps {
  requests: LeaveRequest[];
  showBranch?: boolean;
  userRole: string;
}

export function LeaveRequestTable({ 
  requests, 
  showBranch = false,
  userRole 
}: LeaveRequestTableProps) {
  const router = useRouter();

  const handleStatusUpdate = async (requestId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/leave-requests/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update leave request");
      }

      toast.success("Leave request updated successfully");
      router.refresh();
    } catch (error) {
      toast.error("Failed to update leave request");
    }
  };

  const statusColors = {
    PENDING: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
  } as const;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          {showBranch && <TableHead>Branch</TableHead>}
          <TableHead>Leave Type</TableHead>
          <TableHead>Start Date</TableHead>
          <TableHead>End Date</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Status</TableHead>
          {userRole === "MANAGEMENT" && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((request) => (
          <TableRow key={request.id}>
            <TableCell>{request.user.name}</TableCell>
            {showBranch && (
              <TableCell>{request.user.branch?.name || "-"}</TableCell>
            )}
            <TableCell>{request.leaveType}</TableCell>
            <TableCell>{format(new Date(request.startDate), "PPP")}</TableCell>
            <TableCell>{format(new Date(request.endDate), "PPP")}</TableCell>
            <TableCell>{request.reason}</TableCell>
            <TableCell>
              <Badge className={statusColors[request.status as keyof typeof statusColors]}>
                {request.status}
              </Badge>
            </TableCell>
            {userRole === "MANAGEMENT" && (
              <TableCell>
                {request.status === "PENDING" && (
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-green-100 hover:bg-green-200 text-green-800"
                      onClick={() => handleStatusUpdate(request.id, "APPROVED")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-red-100 hover:bg-red-200 text-red-800"
                      onClick={() => handleStatusUpdate(request.id, "REJECTED")}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
} 