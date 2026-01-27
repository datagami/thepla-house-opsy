"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AdvanceRow } from "./advance-row";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AdvanceData {
  userId: string;
  userName: string;
  userNumId: number;
  userBranch: string;
  totalAdvanceAmount: number;
  totalRemainingAmount: number;
  totalEmiAmount: number;
  advancesCount: number;
  lastPaymentDate: Date | null;
  advances: any[];
}

interface AdvancesTableProps {
  advances: AdvanceData[];
}

export function AdvancesTable({ advances }: AdvancesTableProps) {
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const toggleUser = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const getStatusBadge = (advances: any[]) => {
    if (advances.length === 0) return null;

    const statuses = advances.map((adv) => adv.status);
    const uniqueStatuses = new Set(statuses);

    if (uniqueStatuses.size > 1) {
      return <Badge variant="secondary">MIXED</Badge>;
    }

    const status = statuses[0];
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      PENDING: "outline",
      APPROVED: "default",
      REJECTED: "destructive",
      SETTLED: "secondary",
    };

    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  if (advances.length === 0) {
    return (
      <div className="rounded-md border">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">No advances found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Total Advance</TableHead>
            <TableHead>Remaining Balance</TableHead>
            <TableHead>EMI Amount</TableHead>
            <TableHead className="text-center">Advances Count</TableHead>
            <TableHead>Last Payment</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {advances.map((userAdvance) => {
            const isExpanded = expandedUsers.has(userAdvance.userId);
            const outstandingColor =
              userAdvance.totalRemainingAmount > 25000
                ? "text-red-600 font-semibold"
                : userAdvance.totalRemainingAmount > 10000
                ? "text-orange-600 font-semibold"
                : "";

            return (
              <>
                <TableRow
                  key={userAdvance.userId}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50",
                    isExpanded && "bg-muted/50"
                  )}
                  onClick={() => toggleUser(userAdvance.userId)}
                >
                  <TableCell>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{userAdvance.userName}</div>
                      <div className="text-sm text-muted-foreground">
                        #{userAdvance.userNumId} • {userAdvance.userBranch}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatCurrency(userAdvance.totalAdvanceAmount)}
                  </TableCell>
                  <TableCell className={outstandingColor}>
                    {formatCurrency(userAdvance.totalRemainingAmount)}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(userAdvance.totalEmiAmount)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">
                      {userAdvance.advancesCount}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {userAdvance.lastPaymentDate
                      ? format(new Date(userAdvance.lastPaymentDate), "MMM d, yyyy")
                      : "N/A"}
                  </TableCell>
                  <TableCell>{getStatusBadge(userAdvance.advances)}</TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={8} className="p-0">
                      <div className="bg-muted/30 p-4">
                        <div className="mb-3">
                          <h4 className="font-semibold text-sm">
                            Individual Advances ({userAdvance.advancesCount})
                          </h4>
                        </div>
                        <div className="space-y-2">
                          {userAdvance.advances.map((advance) => (
                            <AdvanceRow key={advance.id} advance={advance} />
                          ))}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
