"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function CreateBranchButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/branches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.get("name"),
          city: formData.get("city"),
          state: formData.get("state"),
          address: formData.get("address"),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create branch");
      }

      toast.success("Branch created successfully");
      setIsOpen(false);
      router.refresh();
    } catch (error) {
      toast.error("Failed to create branch");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Create Branch</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Branch</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Branch Name
            </label>
            <Input
              id="name"
              name="name"
              required
              className="mt-1"
              placeholder="Main Branch"
            />
          </div>
          <div>
            <label htmlFor="city" className="block text-sm font-medium">
              City
            </label>
            <Input
              id="city"
              name="city"
              required
              className="mt-1"
              placeholder="Mumbai"
            />
          </div>
          <div>
            <label htmlFor="state" className="block text-sm font-medium">
              State
            </label>
            <Input
              id="state"
              name="state"
              required
              className="mt-1"
              placeholder="Maharashtra"
            />
          </div>
          <div>
            <label htmlFor="address" className="block text-sm font-medium">
              Address
            </label>
            <Input
              id="address"
              name="address"
              className="mt-1"
              placeholder="123 Main Street"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Branch"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
} 