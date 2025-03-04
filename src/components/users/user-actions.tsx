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
import { MoreHorizontal, UserCog } from "lucide-react";
import { toast } from "sonner";
import { hasAccess } from "@/lib/access-control";

interface Branch {
  id: string;
  name: string;
}

interface UserActionsProps {
  user: {
    id: string;
    status: string;
    role: string;
  };
  branches: Branch[];
  currentUserRole: string;
}

export function UserActions({ user, branches = [], currentUserRole }: UserActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

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

  const canApproveUser = hasAccess(currentUserRole, "users.approve");
  const canChangeRole = hasAccess(currentUserRole, "users.change_role");

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
        {user.status === "PENDING" && canApproveUser && (
          <>
            <DropdownMenuItem
              onClick={handleApprove}
              disabled={isLoading}
            >
              Approve User
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 
