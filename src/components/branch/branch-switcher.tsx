"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { Building } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface Branch {
  id: string;
  name: string;
  city: string;
}

interface BranchSwitcherProps {
  branches: Branch[];
  currentBranchId?: string | null;
}

export function BranchSwitcher({ branches, currentBranchId }: BranchSwitcherProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleBranchChange = async (branchId: string | null) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/users/select-branch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          branchId: branchId === "all" ? null : branchId 
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to switch branch");
      }

      toast.success("Branch switched successfully");
      router.refresh();
    } catch (error) {
      console.error("Failed to switch branch:", error);
      toast.error("Failed to switch branch");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Select
      value={currentBranchId || "all"}
      onValueChange={handleBranchChange}
      disabled={isLoading}
    >
      <SelectTrigger className="w-[200px]">
        <Building className="mr-2 h-4 w-4" />
        <SelectValue placeholder={isLoading ? "Switching..." : "Select branch"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Branches</SelectItem>
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.name} - {branch.city}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
} 