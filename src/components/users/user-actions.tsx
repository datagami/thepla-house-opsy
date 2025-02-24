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
import { MoreHorizontal, Check, X, UserCog, Building } from "lucide-react";
import { toast } from "sonner";

interface Branch {
  id: string;
  name: string;
  city: string;
}

interface UserActionsProps {
  user: {
    id: string;
    status: string;
    role: string;
    branch?: Branch | null;
  };
  branches: Branch[];
}

export function UserActions({ user, branches }: UserActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const updateUser = async (data: { status?: string; role?: string; branchId?: string }) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          ...data,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update user");
      }

      toast.success("User updated successfully");
      router.refresh();
    } catch (error) {
      toast.error("Failed to update user");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
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
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        {user.status === "PENDING" && (
          <>
            <DropdownMenuItem
              onClick={() => updateUser({ status: "ACTIVE" })}
              disabled={isLoading}
            >
              <Check className="mr-2 h-4 w-4" />
              Approve
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateUser({ status: "INACTIVE" })}
              disabled={isLoading}
            >
              <X className="mr-2 h-4 w-4" />
              Reject
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <UserCog className="mr-2 h-4 w-4" />
            Change Role
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              onClick={() => updateUser({ role: "EMPLOYEE" })}
              disabled={isLoading}
            >
              Employee
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateUser({ role: "BRANCH_MANAGER" })}
              disabled={isLoading}
            >
              Branch Manager
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateUser({ role: "HR" })}
              disabled={isLoading}
            >
              HR
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Building className="mr-2 h-4 w-4" />
            Assign Branch
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {branches.map((branch) => (
              <DropdownMenuItem
                key={branch.id}
                onClick={() => updateUser({ branchId: branch.id })}
                disabled={isLoading}
              >
                {branch.name} - {branch.city}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 