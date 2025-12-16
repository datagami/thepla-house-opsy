"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

interface ReferralWithRelations {
  id: string;
  referrerId: string;
  referredUserId: string;
  bonusAmount: number;
  eligibleAt: Date;
  paidAt: Date | null;
  salaryId: string | null;
  createdAt: Date;
  referrer: {
    id: string;
    name: string | null;
    email: string | null;
  };
  referredUser: {
    id: string;
    name: string | null;
    email: string | null;
    doj: Date | null;
  };
  salary: {
    id: string;
    month: number;
    year: number;
    paidAt: Date | null;
  } | null;
}

interface ReferralsTableProps {
  referrals: ReferralWithRelations[];
}

export function ReferralsTable({ referrals }: ReferralsTableProps) {
  const getStatus = (referral: ReferralWithRelations) => {
    if (referral.paidAt) {
      return { label: "Paid", variant: "default" as const };
    }
    const now = new Date();
    const eligibleDate = new Date(referral.eligibleAt);
    if (now >= eligibleDate) {
      return { label: "Eligible", variant: "secondary" as const };
    }
    return { label: "Pending", variant: "outline" as const };
  };

  const formatSalaryPeriod = (month: number, year: number) => {
    const date = new Date(year, month - 1);
    return format(date, "MMM yyyy");
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Referrer</TableHead>
          <TableHead>Referred Employee</TableHead>
          <TableHead>Bonus Amount</TableHead>
          <TableHead>Eligible Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Paid Date</TableHead>
          <TableHead>Paid In Salary</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {referrals.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
              No referrals found
            </TableCell>
          </TableRow>
        ) : (
          referrals.map((referral) => {
            const status = getStatus(referral);
            return (
              <TableRow key={referral.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{referral.referrer.name || "-"}</div>
                    <div className="text-sm text-muted-foreground">
                      {referral.referrer.email || "-"}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{referral.referredUser.name || "-"}</div>
                    <div className="text-sm text-muted-foreground">
                      {referral.referredUser.email || "-"}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-semibold">
                  {formatCurrency(referral.bonusAmount)}
                </TableCell>
                <TableCell>
                  {format(new Date(referral.eligibleAt), "PPP")}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell>
                  {referral.paidAt ? (
                    format(new Date(referral.paidAt), "PPP")
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {referral.salary ? (
                    <div>
                      <div>{formatSalaryPeriod(referral.salary.month, referral.salary.year)}</div>
                      {referral.salary.paidAt && (
                        <div className="text-xs text-muted-foreground">
                          Paid: {format(new Date(referral.salary.paidAt), "PPP")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
