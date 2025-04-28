"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";
import { AdvancePayment } from "@/models/models";
import { Receipt, Trash2, AlertTriangle, Loader2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

interface AdvancePaymentsListProps {
  userId: string;
  refreshKey?: number;
}

interface PaymentHistory {
  id: string;
  amountPaid: number;
  paidAt: Date;
  status: string;
  salary: {
    month: number;
    year: number;
  };
}

export function AdvancePaymentsList({ userId, refreshKey = 0 }: AdvancePaymentsListProps) {
  const [payments, setPayments] = useState<AdvancePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<AdvancePayment | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<AdvancePayment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function fetchPayments() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/users/${userId}/advance-payments`);
        if (!response.ok) {
          throw new Error('Failed to fetch advance payments');
        }
        const data = await response.json();
        setPayments(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch advance payments');
        toast.error('Failed to load advance payments');
      } finally {
        setLoading(false);
      }
    }

    fetchPayments();
  }, [userId, refreshKey]);

  const fetchPaymentHistory = async (advanceId: string) => {
    try {
      setLoadingHistory(true);
      const response = await fetch(`/api/users/${userId}/advance-payments/${advanceId}/history`);
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      setPaymentHistory(data);
    } catch (error) {
      console.error('Failed to fetch payment history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewPayments = async (payment: AdvancePayment) => {
    setSelectedPayment(payment);
    await fetchPaymentHistory(payment.id);
  };

  const handleDeleteClick = (payment: AdvancePayment) => {
    setPaymentToDelete(payment);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!paymentToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/users/${userId}/advance-payments/${paymentToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete advance payment");
      }

      // Update the payments list
      setPayments(payments.filter(p => p.id !== paymentToDelete.id));
      setDeleteDialogOpen(false);
      setPaymentToDelete(null);
      toast.success("Advance payment deleted successfully");
    } catch (error) {
      console.error("Error deleting advance payment:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete advance payment");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        {error}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        No advance payments found
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Amount</TableHead>
              <TableHead>EMI Amount</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Approved By</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>{formatCurrency(payment.amount)}</TableCell>
                <TableCell>{formatCurrency(payment.emiAmount)}</TableCell>
                <TableCell>{formatCurrency(payment.remainingAmount)}</TableCell>
                <TableCell>{payment.reason}</TableCell>
                <TableCell>
                  <Badge variant={payment.isSettled ? "default" : "outline"}>
                    {payment.isSettled ? "Settled" : payment.status}
                  </Badge>
                </TableCell>
                <TableCell>{payment.approvedBy?.name || "-"}</TableCell>
                <TableCell>{formatDate(payment.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewPayments(payment)}
                    >
                      <Receipt className="h-4 w-4 mr-2" />
                      View Payments
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!payment.isSettled && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteClick(payment)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Payment History Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
            <DialogDescription>
              Payment details for advance of {selectedPayment && formatCurrency(selectedPayment.amount)}
            </DialogDescription>
          </DialogHeader>

          {loadingHistory ? (
            <div className="py-4 text-center">Loading payment history...</div>
          ) : (
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Salary Period</TableHead>
                    <TableHead>Payment Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentHistory.map((history) => (
                    <TableRow key={history.id}>
                      <TableCell>{formatCurrency(history.amountPaid)}</TableCell>
                      <TableCell>
                        <Badge variant={history.status === 'APPROVED' ? "default" : "outline"}>
                          {history.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(history.salary.year, history.salary.month - 1).toLocaleString('default', { 
                          month: 'long',
                          year: 'numeric'
                        })}
                      </TableCell>
                      <TableCell>
                        {history.paidAt ? formatDate(history.paidAt) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {paymentHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                        No payment history found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Advance Payment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this advance payment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-sm">This will permanently delete the advance payment.</p>
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
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 
