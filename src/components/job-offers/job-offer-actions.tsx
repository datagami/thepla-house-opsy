'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, FileText, Check, Edit, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface JobOffer {
  id: string;
  name: string;
  designation: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
}

interface Department {
  id: string;
  name: string;
}

interface JobOfferActionsProps {
  jobOffer: JobOffer;
  departments: Department[];
}

export function JobOfferActions({
  jobOffer,
}: JobOfferActionsProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDownloadOfferLetter = () => {
    window.open(`/api/job-offers/${jobOffer.id}/offer-letter`, '_blank');
  };

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/job-offers/${jobOffer.id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to accept job offer');
      }

      toast.success('Job offer accepted successfully');
      router.refresh();
    } catch (error) {
      console.error('Error accepting job offer:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to accept job offer'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/job-offers/${jobOffer.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete job offer');
      }

      toast.success('Job offer deleted successfully');
      router.refresh();
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting job offer:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete job offer'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleDownloadOfferLetter}>
            <FileText className="mr-2 h-4 w-4" />
            Download Offer Letter
          </DropdownMenuItem>
          {jobOffer.status === 'PENDING' && (
            <>
              <DropdownMenuItem onClick={handleAccept}>
                <Check className="mr-2 h-4 w-4" />
                Mark as Accepted
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/job-offers/${jobOffer.id}/edit`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}
          {jobOffer.status === 'ACCEPTED' && (
            <DropdownMenuItem
              onClick={() => router.push(`/users/${jobOffer.id}`)}
            >
              <Edit className="mr-2 h-4 w-4" />
              View Employee Details
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              job offer for {jobOffer.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
