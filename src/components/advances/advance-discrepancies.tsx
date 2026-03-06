"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  CalendarX,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

interface Installment {
  id: string;
  amountPaid: number;
  status: string;
  approvedAt: string | null;
  paidAt: string | null;
  salaryMonth: number | null;
  salaryYear: number | null;
  salaryStatus: string | null;
  approvedByName: string | null;
}

interface AdvanceDetail {
  advanceId: string;
  advanceNumId: number;
  amount: number;
  emiAmount: number;
  remainingAmount: number;
  isSettled: boolean;
  createdAt: string;
  totalDeducted: number;
  totalTracked: number;
  discrepancyAmount: number;
  installments: Installment[];
}

interface DeletedSalaryMonth {
  month: number;
  year: number;
  deletedAt: string;
}

interface UserDiscrepancy {
  userId: string;
  userName: string;
  userNumId: number;
  userBranch: string;
  totalDiscrepancy: number;
  deletedSalaryMonths: DeletedSalaryMonth[];
  advances: AdvanceDetail[];
}

interface Stats {
  totalDiscrepancy: number;
  affectedAdvances: number;
  affectedEmployees: number;
}

export function AdvanceDiscrepancies() {
  const [users, setUsers] = useState<UserDiscrepancy[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalDiscrepancy: 0,
    affectedAdvances: 0,
    affectedEmployees: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [expandedAdvances, setExpandedAdvances] = useState<Set<string>>(
    new Set()
  );

  const fetchDiscrepancies = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/advances/discrepancies");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setUsers(data.users);
      setStats(data.stats);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load discrepancies");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscrepancies();
  }, []);

  const toggleUser = (userId: string) => {
    const next = new Set(expandedUsers);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    setExpandedUsers(next);
  };

  const toggleAdvance = (advanceId: string) => {
    const next = new Set(expandedAdvances);
    if (next.has(advanceId)) {
      next.delete(advanceId);
    } else {
      next.add(advanceId);
    }
    setExpandedAdvances(next);
  };

  const getInstallmentStatusVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      PENDING: "outline",
      APPROVED: "default",
      PAID: "default",
      REJECTED: "destructive",
    };
    return variants[status] || "secondary";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-[100px]" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[120px] mb-1" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Advance Discrepancies
        </h1>
        <p className="text-muted-foreground">
          Advance payments where deductions were lost due to salary deletions
          (read-only audit view)
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Discrepancy
            </CardTitle>
            <div className="p-2 rounded-lg bg-red-100">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(stats.totalDiscrepancy)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Amount incorrectly deducted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Affected Advances
            </CardTitle>
            <div className="p-2 rounded-lg bg-orange-100">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.affectedAdvances}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Advances with mismatched balances
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Affected Employees
            </CardTitle>
            <div className="p-2 rounded-lg bg-orange-100">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.affectedEmployees}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Employees impacted
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Consolidated User View */}
      {users.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold">No discrepancies found</h3>
            <p className="text-muted-foreground text-sm mt-1">
              All advance payment balances are consistent with their
              installments.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((user) => {
            const isUserExpanded = expandedUsers.has(user.userId);

            return (
              <Card key={user.userId}>
                {/* User Header - clickable */}
                <div
                  className={cn(
                    "flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 rounded-t-lg",
                    isUserExpanded && "border-b"
                  )}
                  onClick={() => toggleUser(user.userId)}
                >
                  <div className="flex items-center gap-3">
                    {isUserExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <div className="font-semibold text-lg">
                        {user.userName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        #{user.userNumId} &bull; {user.userBranch} &bull;{" "}
                        {user.advances.length} advance(s)
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Deleted salary months */}
                    {user.deletedSalaryMonths.length > 0 && (
                      <div className="flex flex-wrap gap-1 max-w-md justify-end">
                        {user.deletedSalaryMonths.slice(0, 5).map((dm, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="border-red-300 text-red-700 bg-red-50 text-xs"
                            title={`Salary deleted on ${format(new Date(dm.deletedAt), "MMM d, yyyy")}`}
                          >
                            <CalendarX className="mr-1 h-3 w-3" />
                            {format(
                              new Date(dm.year, dm.month - 1),
                              "MMM yyyy"
                            )}
                          </Badge>
                        ))}
                        {user.deletedSalaryMonths.length > 5 && (
                          <Badge
                            variant="outline"
                            className="border-red-300 text-red-700 bg-red-50 text-xs"
                          >
                            +{user.deletedSalaryMonths.length - 5} more
                          </Badge>
                        )}
                      </div>
                    )}
                    <Badge variant="destructive" className="text-sm px-3 py-1">
                      {formatCurrency(user.totalDiscrepancy)}
                    </Badge>
                  </div>
                </div>

                {/* Expanded User Content */}
                {isUserExpanded && (
                  <CardContent className="pt-4 space-y-4">
                    {/* Deleted Salary Months Detail */}
                    {user.deletedSalaryMonths.length > 0 && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="text-sm font-medium text-red-800 mb-2">
                          Deleted Salary Months (deductions may have been lost
                          from these)
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {user.deletedSalaryMonths.map((dm, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="border-red-300 text-red-700 bg-white text-xs"
                            >
                              <CalendarX className="mr-1 h-3 w-3" />
                              {format(
                                new Date(dm.year, dm.month - 1),
                                "MMMM yyyy"
                              )}{" "}
                              &mdash; deleted{" "}
                              {format(
                                new Date(dm.deletedAt),
                                "MMM d, yyyy"
                              )}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Each Advance */}
                    {user.advances.map((advance) => {
                      const isAdvExpanded = expandedAdvances.has(
                        advance.advanceId
                      );

                      return (
                        <Card
                          key={advance.advanceId}
                          className="border-l-4 border-l-orange-400"
                        >
                          <div
                            className={cn(
                              "flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30",
                              isAdvExpanded && "border-b"
                            )}
                            onClick={() => toggleAdvance(advance.advanceId)}
                          >
                            <div className="flex items-center gap-3">
                              {isAdvExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-1">
                                <div>
                                  <div className="text-xs text-muted-foreground">
                                    Advance
                                  </div>
                                  <div className="font-semibold">
                                    #{advance.advanceNumId}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">
                                    Amount
                                  </div>
                                  <div className="font-semibold text-blue-600">
                                    {formatCurrency(advance.amount)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">
                                    Current Remaining
                                  </div>
                                  <div className="font-semibold text-orange-600">
                                    {formatCurrency(advance.remainingAmount)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">
                                    Tracked Deductions
                                  </div>
                                  <div className="font-semibold">
                                    {formatCurrency(advance.totalTracked)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">
                                    Expected Remaining
                                  </div>
                                  <div className="font-semibold text-green-600">
                                    {formatCurrency(
                                      advance.amount - advance.totalTracked
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <Badge
                              variant="destructive"
                              className="text-xs"
                            >
                              {formatCurrency(advance.discrepancyAmount)}
                            </Badge>
                          </div>

                          {/* Installments Table */}
                          {isAdvExpanded && (
                            <div className="p-4">
                              <div className="text-sm font-medium mb-2">
                                All Installments (
                                {advance.installments.length})
                              </div>
                              {advance.installments.length > 0 ? (
                                <div className="rounded-md border">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Salary Month</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Approved By</TableHead>
                                        <TableHead>Approved At</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {advance.installments.map((inst) => (
                                        <TableRow key={inst.id}>
                                          <TableCell>
                                            {inst.salaryMonth && inst.salaryYear
                                              ? format(
                                                  new Date(
                                                    inst.salaryYear,
                                                    inst.salaryMonth - 1
                                                  ),
                                                  "MMM yyyy"
                                                )
                                              : "N/A"}
                                          </TableCell>
                                          <TableCell className="font-medium">
                                            {formatCurrency(inst.amountPaid)}
                                          </TableCell>
                                          <TableCell>
                                            <Badge
                                              variant={getInstallmentStatusVariant(
                                                inst.status
                                              )}
                                            >
                                              {inst.status}
                                            </Badge>
                                          </TableCell>
                                          <TableCell>
                                            {inst.approvedByName ?? "N/A"}
                                          </TableCell>
                                          <TableCell>
                                            {inst.approvedAt
                                              ? format(
                                                  new Date(inst.approvedAt),
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
                                <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
                                  No installments found — all were likely
                                  deleted with the salary
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
