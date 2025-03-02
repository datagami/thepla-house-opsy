"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { LeaveRequestTable } from "./leave-request-table";
import { LeaveRequestForm } from "./leave-request-form";
import {LeaveRequest} from "@/models/models";

interface LeaveRequestContentProps {
  leaveRequests: LeaveRequest[];
  userRole: string;
}

export function LeaveRequestContent({ leaveRequests, userRole }: LeaveRequestContentProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Leave Requests</h2>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Request
        </Button>
      </div>

      <div className="rounded-md border">
        <LeaveRequestTable 
          leaveRequests={leaveRequests}
          userRole={userRole}
          onNewRequest={() => setIsFormOpen(true)}
        />
      </div>

      <LeaveRequestForm 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
      />
    </div>
  );
} 
