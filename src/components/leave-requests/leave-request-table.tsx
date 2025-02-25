"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { LeaveRequestActions } from "./leave-request-actions";
import { LeaveRequestForm } from "./leave-request-form";

interface LeaveRequest {
  id: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: string;
  user: {
    name: string | null;
    branch: {
      name: string | null;
    } | null;
  };
}

interface LeaveRequestTableProps {
  leaveRequests: LeaveRequest[];
  userRole: string;
}

const statusColors = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
} as const;

export function LeaveRequestTable({ leaveRequests, userRole }: LeaveRequestTableProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>End Date</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaveRequests.map((request) => (
            <TableRow key={request.id}>
              <TableCell>{request.user.name}</TableCell>
              <TableCell>{request.user.branch?.name || "-"}</TableCell>
              <TableCell>{format(new Date(request.startDate), "PPP")}</TableCell>
              <TableCell>{format(new Date(request.endDate), "PPP")}</TableCell>
              <TableCell>{request.reason}</TableCell>
              <TableCell>
                <Badge className={statusColors[request.status as keyof typeof statusColors]}>
                  {request.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <LeaveRequestActions 
                  request={request}
                  userRole={userRole}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <LeaveRequestForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
      />
    </>
  );
} 