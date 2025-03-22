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
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { AdvancePayment } from "@/models/models";
import { Receipt } from "lucide-react";

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
  const [selectedPayment, setSelectedPayment] = useState<AdvancePayment | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    async function fetchPayments() {
      try {
        const response = await fetch(`/api/users/${userId}/advance-payments`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setPayments(data);
      } catch (error) {
        console.error('Failed to fetch advance payments:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPayments();
  }, [userId, refreshKey]);

  const fetchPaymentHistory = async (advanceId: string) => {
    try {
      console.log(userId, advanceId);
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  if (loading) return <div>Loading...</div>;

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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewPayments(payment)}
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    View Payments
                  </Button>
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
    </>
  );
} 
