"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Branch {
  id: string;
  name: string;
  city: string;
}

interface BranchSelectorProps {
  branches: Branch[];
  userRole: string;
}

export function BranchSelector({ branches, userRole }: BranchSelectorProps) {
  const router = useRouter();
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleBranchSelect = async () => {
    if (!selectedBranch) {
      toast.error("Please select a branch");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/users/select-branch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branchId: selectedBranch,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to select branch");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error("Failed to select branch");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Select Branch</h2>
          <p className="text-muted-foreground mt-2">
            {userRole === "MANAGEMENT"
              ? "Select a branch to view"
              : "Confirm your branch"}
          </p>
        </div>

        <div className="space-y-4">
          <Select
            value={selectedBranch}
            onValueChange={setSelectedBranch}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name} - {branch.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            className="w-full"
            onClick={handleBranchSelect}
            disabled={isLoading || !selectedBranch}
          >
            {isLoading ? "Loading..." : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
} 