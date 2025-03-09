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
import { formatDate } from "@/lib/utils";
import {AdvancePayment} from "@/models/models";


interface AdvancePaymentsListProps {
  userId: string;
  refreshKey?: number;
}

export function AdvancePaymentsList({ userId, refreshKey = 0 }: AdvancePaymentsListProps) {
  const [payments, setPayments] = useState<AdvancePayment[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div>Loading...</div>;

  return (
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell>₹{payment.amount.toFixed(2)}</TableCell>
              <TableCell>₹{payment.emiAmount.toFixed(2)}</TableCell>
              <TableCell>₹{payment.remainingAmount.toFixed(2)}</TableCell>
              <TableCell>{payment.reason}</TableCell>
              <TableCell>
                <Badge variant={payment.isSettled ? "default" : "outline"}>
                  {payment.isSettled ? "Settled" : payment.status}
                </Badge>
              </TableCell>
              <TableCell>{payment.approvedBy?.name || "-"}</TableCell>
              <TableCell>{formatDate(payment.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 
