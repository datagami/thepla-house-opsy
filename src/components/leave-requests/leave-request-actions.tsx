"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Check, X } from "lucide-react";
import { toast } from "sonner";
import {LeaveRequest} from "@/models/models";


interface LeaveRequestActionsProps {
  request: LeaveRequest;
  userRole: string;
}

export function LeaveRequestActions({ request, userRole }: LeaveRequestActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async (action: "approve" | "reject") => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/leave-requests/${request.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: action === "approve" ? "APPROVED" : "REJECTED",
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} leave request`);
      }

      toast.success(`Leave request ${action}d successfully`);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(`Failed to ${action} leave request`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!["BRANCH_MANAGER", "HR"].includes(userRole) || request.status !== "PENDING") {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => handleAction("approve")}
          disabled={isLoading}
        >
          <Check className="mr-2 h-4 w-4" />
          Approve
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleAction("reject")}
          disabled={isLoading}
          className="text-red-600"
        >
          <X className="mr-2 h-4 w-4" />
          Reject
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 
