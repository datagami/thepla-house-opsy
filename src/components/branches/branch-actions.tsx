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
import { MoreHorizontal, Edit, Trash } from "lucide-react";
import { toast } from "sonner";

interface Branch {
  id: string;
  name: string;
  _count: {
    users: number;
    managers: number;
  };
}

interface BranchActionsProps {
  branch: Branch;
}

export function BranchActions({ branch }: BranchActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const deleteBranch = async () => {
    if (branch._count.users > 0 || branch._count.managers > 0) {
      toast.error("Cannot delete branch with assigned users");
      return;
    }

    if (!confirm("Are you sure you want to delete this branch?")) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/branches/${branch.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete branch");
      }

      toast.success("Branch deleted successfully");
      router.refresh();
    } catch (error) {
      toast.error("Failed to delete branch");
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
        <DropdownMenuItem
          onClick={() => router.push(`/branches/${branch.id}/edit`)}
          disabled={isLoading}
        >
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={deleteBranch}
          disabled={isLoading || branch._count.users > 0}
          className="text-red-600"
        >
          <Trash className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 