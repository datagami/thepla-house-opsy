"use client";

import {useState} from "react";
import {Button} from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {Loader2, Trash2, AlertTriangle, Receipt} from "lucide-react";
import {toast} from "sonner";
import {Salary} from "@prisma/client";
import Link from "next/link";

interface SalaryActionsProps {
  userId: string;
  month: number;
  year: number;
  salary: Salary | null;
}

export function SalaryActions({userId, month, year, salary}: SalaryActionsProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleGenerateSalary = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/salaries/${userId}/${month}/${year}`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate salary");
      }

      toast.success("Salary generated successfully");
      // Refresh the page to show the new salary
      window.location.reload();
    } catch (error) {
      console.error("Error generating salary:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate salary");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteSalary = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/salaries/${userId}/${month}/${year}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete salary");
      }

      toast.success("Salary deleted successfully");
      // Refresh the page to update the UI
      window.location.reload();
    } catch (error) {
      console.error("Error deleting salary:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete salary");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!salary ? (
        <Button
          onClick={handleGenerateSalary}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
              Generating...
            </>
          ) : (
            "Generate Salary"
          )}
        </Button>
      ) : (
        <>
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4"/>
            Delete Salary
          </Button>
        </>
      )}
      {salary && <Link href={`/salary/${salary?.id}`}>
          <Button variant="outline" size="sm">
              <Receipt className="mr-2 h-4 w-4"/>
              View Salary
          </Button>
      </Link>}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Salary</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this salary? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4"/>
            <p className="text-sm">This will permanently delete the salary for {month}/{year}.</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSalary}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
