"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ReferralsTable } from "@/components/referrals/referrals-table";
import { DownloadReferralsReport } from "@/components/referrals/download-referrals-report";
import { toast } from "sonner";

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

interface ReferralsManagementProps {
  initialReferrals: ReferralWithRelations[];
  userRole: string;
}

export function ReferralsManagement({
  initialReferrals,
  userRole,
}: ReferralsManagementProps) {
  const [referrals, setReferrals] = useState<ReferralWithRelations[]>(initialReferrals);
  const [filteredReferrals, setFilteredReferrals] = useState<ReferralWithRelations[]>(initialReferrals);
  const [status, setStatus] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("ALL");
  const [branches, setBranches] = useState<string[]>([]);

  const isHROrManagement = ["HR", "MANAGEMENT"].includes(userRole);

  useEffect(() => {
    // Fetch branches if user is HR or Management
    if (isHROrManagement) {
      fetch("/api/reports/branches")
        .then((res) => res.json())
        .then((data) => setBranches(data))
        .catch((err) => console.error("Error fetching branches:", err));
    }
  }, [isHROrManagement]);

  useEffect(() => {
    // Apply filters
    let filtered = [...referrals];

    // Status filter
    if (status !== "ALL") {
      filtered = filtered.filter((referral) => {
        const now = new Date();
        const eligibleDate = new Date(referral.eligibleAt);

        if (status === "paid") {
          return referral.paidAt !== null;
        } else if (status === "eligible") {
          return referral.paidAt === null && now >= eligibleDate;
        } else if (status === "pending") {
          return referral.paidAt === null && now < eligibleDate;
        }
        return true;
      });
    }

    // Date range filter
    if (fromDate) {
      const from = new Date(fromDate);
      filtered = filtered.filter(
        (referral) => new Date(referral.eligibleAt) >= from
      );
    }
    if (toDate) {
      const to = new Date(toDate);
      filtered = filtered.filter(
        (referral) => new Date(referral.eligibleAt) <= to
      );
    }

    // Branch filter
    if (branchId !== "ALL" && isHROrManagement) {
      filtered = filtered.filter(
        (referral) => referral.referrer.id === branchId
      );
    }

    setFilteredReferrals(filtered);
  }, [status, fromDate, toDate, branchId, referrals, isHROrManagement]);

  const handleReset = () => {
    setStatus("ALL");
    setFromDate("");
    setToDate("");
    setBranchId("ALL");
  };

  // Calculate stats
  const totalReferrals = filteredReferrals.length;
  const paidCount = filteredReferrals.filter((r) => r.paidAt).length;
  const eligibleCount = filteredReferrals.filter(
    (r) => !r.paidAt && new Date(r.eligibleAt) <= new Date()
  ).length;
  const pendingCount = filteredReferrals.filter(
    (r) => !r.paidAt && new Date(r.eligibleAt) > new Date()
  ).length;
  const totalBonusPaid = filteredReferrals
    .filter((r) => r.paidAt)
    .reduce((sum, r) => sum + r.bonusAmount, 0);
  const totalBonusPending = filteredReferrals
    .filter((r) => !r.paidAt)
    .reduce((sum, r) => sum + r.bonusAmount, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Referrals</CardTitle>
              <CardDescription>
                View and manage employee referral bonuses
              </CardDescription>
            </div>
            {isHROrManagement && (
              <DownloadReferralsReport
                filters={{
                  status,
                  fromDate,
                  toDate,
                  branchId,
                }}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="eligible">Eligible</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              placeholder="From Date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />

            <Input
              type="date"
              placeholder="To Date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />

            {isHROrManagement && (
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button onClick={handleReset} variant="outline">
              Reset Filters
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalReferrals}</div>
                <p className="text-xs text-muted-foreground">Referrals</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Paid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{paidCount}</div>
                <p className="text-xs text-muted-foreground">Referrals</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Eligible</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{eligibleCount}</div>
                <p className="text-xs text-muted-foreground">Referrals</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
                <p className="text-xs text-muted-foreground">Referrals</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Paid Bonus</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{totalBonusPaid.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Amount</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Bonus</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{totalBonusPending.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Amount</p>
              </CardContent>
            </Card>
          </div>

          {/* Referrals Table */}
          <div className="rounded-md border">
            <ReferralsTable referrals={filteredReferrals} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
