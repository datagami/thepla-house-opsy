"use client";

import { useState, useEffect } from "react";
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
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Appraisal {
  id: string;
  previousSalary: number;
  newSalary: number;
  changeAmount: number;
  changePercentage: number;
  effectiveDate: string;
  changedBy: { name: string; numId: number } | null;
}

interface AppraisalHistoryProps {
  userId: string;
}

export function AppraisalHistory({ userId }: AppraisalHistoryProps) {
  const [appraisals, setAppraisals] = useState<Appraisal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAppraisals() {
      try {
        const response = await fetch(`/api/users/${userId}/appraisals`);
        if (response.ok) {
          const data = await response.json();
          setAppraisals(data);
        }
      } catch (error) {
        console.error("Error fetching appraisals:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAppraisals();
  }, [userId]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (appraisals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No salary appraisal history found.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Previous Salary</TableHead>
            <TableHead>New Salary</TableHead>
            <TableHead>Change</TableHead>
            <TableHead>Changed By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appraisals.map((appraisal) => {
            const isIncrease = appraisal.changeAmount > 0;
            return (
              <TableRow key={appraisal.id}>
                <TableCell>
                  {new Date(appraisal.effectiveDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell>{formatCurrency(appraisal.previousSalary)}</TableCell>
                <TableCell className="font-medium">
                  {formatCurrency(appraisal.newSalary)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {isIncrease ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <Badge variant={isIncrease ? "default" : "destructive"}>
                      {isIncrease ? "+" : ""}
                      {appraisal.changePercentage}%
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({isIncrease ? "+" : ""}
                      {formatCurrency(appraisal.changeAmount)})
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {appraisal.changedBy?.name ?? "System"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
