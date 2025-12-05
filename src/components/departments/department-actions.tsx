"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Department {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count: {
    users: number;
  };
}

interface DepartmentActionsProps {
  department: Department;
}

export function DepartmentActions({ department }: DepartmentActionsProps) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/departments", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: department.id,
          name: formData.get("name"),
          description: formData.get("description"),
          isActive: formData.get("isActive") === "on",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update department");
      }

      toast.success("Department updated successfully");
      setIsEditOpen(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update department"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/departments?id=${department.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete department");
      }

      toast.success("Department deleted successfully");
      setIsDeleteOpen(false);
      setDropdownOpen(false);
      // Small delay to ensure dialog closes before refresh
      setTimeout(() => {
        router.refresh();
      }, 100);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete department"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            onClick={() => {
              setDropdownOpen(false);
              setIsEditOpen(true);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setDropdownOpen(false);
              setIsDeleteOpen(true);
            }}
            className="text-red-600"
            disabled={department._count.users > 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <Dialog 
        open={isEditOpen} 
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setDropdownOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">
                Department Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                name="name"
                required
                className="mt-1"
                defaultValue={department.name}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                name="description"
                className="mt-1"
                defaultValue={department.description || ""}
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-isActive"
                name="isActive"
                defaultChecked={department.isActive}
              />
              <Label htmlFor="edit-isActive">Active</Label>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update Department"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog 
        open={isDeleteOpen} 
        onOpenChange={(open) => {
          setIsDeleteOpen(open);
          if (!open) {
            setDropdownOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Department</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {department._count.users > 0 ? (
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">
                  Cannot delete this department
                </p>
                <p>
                  This department has {department._count.users}{" "}
                  {department._count.users === 1 ? "employee" : "employees"} assigned to it.
                </p>
                <p className="mt-2">
                  Please reassign or remove all employees from this department before
                  deleting it.
                </p>
                <div className="flex justify-end mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsDeleteOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p>
                  Are you sure you want to permanently delete the department &quot;{department.name}&quot;?
                  This action cannot be undone and will completely remove the department from the system.
                </p>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsDeleteOpen(false)}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isLoading}
                  >
                    {isLoading ? "Deleting..." : "Delete Permanently"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

