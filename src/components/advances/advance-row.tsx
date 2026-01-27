"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Installment {
  id: string;
  numId: number;
  amountPaid: number;
  status: string;
  paidAt: Date | null;
  approvedAt: Date | null;
  salary?: {
    month: number;
    year: number;
  } | null;
  approvedBy?: {
    name: string;
    numId: number;
  } | null;
}

interface Advance {
  id: string;
  numId: number;
  amount: number;
  remainingAmount: number;
  emiAmount: number;
  status: string;
  reason?: string | null;
  createdAt: Date;
  approvedAt?: Date | null;
  isSettled: boolean;
  approvedBy?: {
    name: string;
    numId: number;
  } | null;
  installments?: Installment[];
}

interface AdvanceRowProps {
  advance: Advance;
}

export function AdvanceRow({ advance }: AdvanceRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      PENDING: "outline",
      APPROVED: "default",
      PAID: "default",
      REJECTED: "destructive",
      SETTLED: "secondary",
    };
    return variants[status] || "secondary";
  };

  const getInstallmentStatusVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      PENDING: "outline",
      APPROVED: "default",
      PAID: "default",
      REJECTED: "destructive",
    };
    return variants[status] || "secondary";
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="p-4">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 flex-1">
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Advance ID
                </div>
                <div className="font-semibold">#{advance.numId}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Amount
                </div>
                <div className="font-semibold text-blue-600">
                  {formatCurrency(advance.amount)}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Remaining
                </div>
                <div
                  className={cn(
                    "font-semibold",
                    advance.remainingAmount > 0
                      ? "text-orange-600"
                      : "text-green-600"
                  )}
                >
                  {formatCurrency(advance.remainingAmount)}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  EMI
                </div>
                <div className="font-semibold">
                  {formatCurrency(advance.emiAmount)}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Status
                </div>
                <Badge variant={getStatusVariant(advance.status)}>
                  {advance.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 space-y-4">
            {/* Advance Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-muted rounded-md">
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Reason
                </div>
                <div className="text-sm">{advance.reason || "N/A"}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Requested Date
                </div>
                <div className="text-sm">
                  {format(new Date(advance.createdAt), "MMM d, yyyy")}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Approved By
                </div>
                <div className="text-sm">
                  {advance.approvedBy
                    ? `${advance.approvedBy.name} (#${advance.approvedBy.numId})`
                    : "N/A"}
                </div>
              </div>

              {advance.approvedAt && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Approved Date
                  </div>
                  <div className="text-sm">
                    {format(new Date(advance.approvedAt), "MMM d, yyyy")}
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Is Settled
                </div>
                <div className="text-sm">
                  {advance.isSettled ? (
                    <Badge variant="secondary">Yes</Badge>
                  ) : (
                    <Badge variant="outline">No</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Payment History */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-semibold text-sm">
                  Payment History (
                  {advance.installments?.length || 0} installments)
                </h5>
              </div>

              {advance.installments && advance.installments.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Installment #</TableHead>
                        <TableHead>Amount Paid</TableHead>
                        <TableHead>Salary Month/Year</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Paid Date</TableHead>
                        <TableHead>Approved By</TableHead>
                        <TableHead>Approved Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {advance.installments.map((installment) => (
                        <TableRow key={installment.id}>
                          <TableCell className="font-medium">
                            #{installment.numId}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(installment.amountPaid)}
                          </TableCell>
                          <TableCell>
                            {installment.salary
                              ? `${installment.salary.month}/${installment.salary.year}`
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getInstallmentStatusVariant(
                                installment.status
                              )}
                            >
                              {installment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {installment.paidAt
                              ? format(
                                  new Date(installment.paidAt),
                                  "MMM d, yyyy"
                                )
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            {installment.approvedBy
                              ? `${installment.approvedBy.name} (#${installment.approvedBy.numId})`
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            {installment.approvedAt
                              ? format(
                                  new Date(installment.approvedAt),
                                  "MMM d, yyyy"
                                )
                              : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="rounded-md border p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No installments recorded
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
