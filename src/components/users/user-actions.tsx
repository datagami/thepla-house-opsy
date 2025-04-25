"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, UserCog, Calendar, Printer, Edit, Eye } from "lucide-react";
import { toast } from "sonner";
import { hasAccess } from "@/lib/access-control";
import { User } from "@/models/models";

interface UserActionsProps {
  user: User;
  currentUserRole: string;
  onUpdate?: () => void;
}

export function UserActions({ user, currentUserRole, onUpdate }: UserActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const canApproveUser = hasAccess(currentUserRole, "users.approve");
  const canChangeRole = hasAccess(currentUserRole, "users.change_role");
  const canViewAttendance = ['HR', 'MANAGEMENT'].includes(currentUserRole);
  const canEdit = ['HR', 'MANAGEMENT'].includes(currentUserRole);

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/users/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve user");
      }

      toast.success("User approved successfully");
      router.refresh();
    } catch (err) {
      toast.error("Failed to approve user");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeRole = async (newRole: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${user.id}/change-role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: newRole,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to change user role");
      }

      toast.success("User role updated successfully");
      router.refresh();
    } catch (error) {
      toast.error("Failed to change user role");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (userId: string, newStatus: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/users/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update status');
      }

      toast.success(`User status updated to ${newStatus.toLowerCase()}`);
      
      if (onUpdate) {
        onUpdate();
      }
      router.refresh();

    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewAttendance = () => {
    const currentDate = new Date();
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    router.push(`/attendance/${user.id}?month=${year}-${month.toString().padStart(2, '0')}`);
  };

  const handlePrintJoiningForm = async () => {
    try {
      const response = await fetch(`/api/users/joining-form?userId=${user.id}`);
      if (!response.ok) throw new Error('Failed to generate joining form');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `joining-form-${user.numId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to print joining form:', error);
      toast.error('Failed to generate joining form');
    }
  };

  const handleEdit = () => {
    router.push(`/users/${user.id}`);
  };

  const handleView = () => {
    router.push(`/users/${user.id}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* Primary Actions */}
        <DropdownMenuLabel>Primary Actions</DropdownMenuLabel>
        {canEdit ? (
          <DropdownMenuItem onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit User
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={handleView}>
            <Eye className="mr-2 h-4 w-4" />
            View User
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={handlePrintJoiningForm}
        >
          <Printer className="mr-2 h-4 w-4" />
          Print Joining Form
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {/* Status Management */}
        <DropdownMenuLabel>Status Management</DropdownMenuLabel>
        {user.status === "PENDING" && canApproveUser && (
          <DropdownMenuItem
            onClick={handleApprove}
            disabled={isLoading}
          >
            Approve User
          </DropdownMenuItem>
        )}
        {user.status === "ACTIVE" ? (
          <DropdownMenuItem
            className="text-red-600"
            onClick={() => handleStatusUpdate(user.id, "INACTIVE")}
          >
            Mark as Inactive
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className="text-green-600"
            onClick={() => handleStatusUpdate(user.id, "ACTIVE")}
          >
            Mark as Active
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />

        {/* Role & Access Management */}
        <DropdownMenuLabel>Role & Access</DropdownMenuLabel>
        {canChangeRole && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <UserCog className="mr-2 h-4 w-4" />
              Change Role
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onClick={() => handleChangeRole("EMPLOYEE")}
                disabled={isLoading}
              >
                Employee
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleChangeRole("BRANCH_MANAGER")}
                disabled={isLoading}
              >
                Branch Manager
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleChangeRole("HR")}
                disabled={isLoading}
              >
                HR
              </DropdownMenuItem>
              {currentUserRole === "MANAGEMENT" && (
                <DropdownMenuItem
                  onClick={() => handleChangeRole("MANAGEMENT")}
                  disabled={isLoading}
                >
                  Management
                </DropdownMenuItem>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuSeparator />

        {/* Additional Features */}
        <DropdownMenuLabel>Additional Features</DropdownMenuLabel>
        {canViewAttendance && (
          <DropdownMenuItem
            onClick={handleViewAttendance}
          >
            <Calendar className="mr-2 h-4 w-4" />
            View & Manage Attendance
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 
