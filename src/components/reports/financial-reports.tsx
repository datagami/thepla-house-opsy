"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, DollarSign, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";

interface FinancialReportsProps {
  userRole: string;
}

interface FinancialStats {
  totalSalary: number;
  totalPaidSalary: number;
  totalUnpaidSalary: number;
  paidCount: number;
  unpaidCount: number;
  totalAdvance: number;
  totalReferralBonus: number;
  salaryByBranch: Array<{
    branch: string;
    amount: number;
    employeeCount: number;
    previousAmount: number | null;
    difference: number | null;
  }>;
  advanceSummary: Array<{
    status: string;
    count: number;
    amount: number;
  }>;
  advanceByBranch: Array<{
    branch: string;
    amount: number;
    count: number;
    employeeCount: number;
  }>;
  advanceByIndividual: Array<{
    userId: string;
    name: string;
    branch: string;
    amount: number;
    count: number;
  }>;
  salaryTrend: Array<{
    month: string;
    amount: number;
  }>;
}

export function FinancialReports({ userRole }: FinancialReportsProps) {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [branch, setBranch] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [branches, setBranches] = useState<string[]>([]);

  const fetchFinancialReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: month.toString(),
        year: year.toString(),
        branch: branch,
      });

      const response = await fetch(`/api/reports/financial?${params}`);
      if (!response.ok) throw new Error("Failed to fetch financial report");
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching financial report:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch branches
    if (userRole !== "BRANCH_MANAGER") {
      fetch("/api/reports/branches")
        .then((res) => res.json())
        .then((data) => setBranches(data))
        .catch((err) => console.error("Error fetching branches:", err));
    }
  }, [userRole]);

  useEffect(() => {
    fetchFinancialReport();
  }, [month, year, branch]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        month: month.toString(),
        year: year.toString(),
        branch: branch,
        format: "excel",
      });

      const response = await fetch(`/api/reports/financial/export?${params}`);
      if (!response.ok) throw new Error("Failed to export report");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `financial-report-${month}-${year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error exporting report:", error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Financial Reports</CardTitle>
              <CardDescription>
                Salary, advances, and financial analytics
              </CardDescription>
            </div>
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Select
              value={month.toString()}
              onValueChange={(value) => setMonth(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={m.toString()}>
                    {format(new Date(2024, m - 1, 1), "MMMM")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={year.toString()}
              onValueChange={(value) => setYear(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {userRole !== "BRANCH_MANAGER" && (
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Branches</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button onClick={fetchFinancialReport} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>

          {stats && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Salary</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(stats.totalSalary)}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Advance</CardTitle>
                    <ArrowDown className="h-4 w-4 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {formatCurrency(stats.totalAdvance)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Referral Bonus</CardTitle>
                    <ArrowUp className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(stats.totalReferralBonus)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Paid Salary</CardTitle>
                    <ArrowUp className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(stats.totalPaidSalary)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.paidCount} employee{stats.paidCount !== 1 ? 's' : ''} paid
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Unpaid Salary</CardTitle>
                    <ArrowDown className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(stats.totalUnpaidSalary)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.unpaidCount} employee{stats.unpaidCount !== 1 ? 's' : ''} unpaid
                    </p>
                  </CardContent>
                </Card>
              </div>

              {stats.salaryByBranch.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Salary by Branch</CardTitle>
                    <CardDescription>
                      Same order as salary report. Difference vs previous month ({format(new Date(year, month - 2, 1), "MMM yyyy")}).
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stats.salaryByBranch.map((branch) => (
                        <div key={branch.branch} className="space-y-2">
                          <div className="flex justify-between items-baseline gap-2 text-sm">
                            <span className="font-medium">
                              {branch.branch} ({branch.employeeCount} employees)
                            </span>
                            <div className="flex flex-col items-end">
                              <span className="font-bold">{formatCurrency(branch.amount)}</span>
                              {branch.difference != null && (
                                <span
                                  className={
                                    branch.difference > 0
                                      ? "text-xs text-green-600"
                                      : branch.difference < 0
                                        ? "text-xs text-red-600"
                                        : "text-xs text-muted-foreground"
                                  }
                                >
                                  {branch.difference > 0 && "+"}
                                  {formatCurrency(branch.difference)} vs prev month
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {stats.advanceByBranch.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Advance by Branch</CardTitle>
                      <CardDescription>
                        Advance payments created in {format(new Date(year, month - 1, 1), "MMMM yyyy")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {stats.advanceByBranch.map((b) => (
                          <div key={b.branch} className="flex justify-between text-sm">
                            <span className="font-medium">
                              {b.branch} ({b.employeeCount} employees, {b.count} advances)
                            </span>
                            <span className="font-bold text-orange-600">{formatCurrency(b.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {stats.advanceByIndividual.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Advance by Individual</CardTitle>
                      <CardDescription>
                        Advance payments created in {format(new Date(year, month - 1, 1), "MMMM yyyy")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
                        {stats.advanceByIndividual.map((u) => (
                          <div key={u.userId} className="flex items-start justify-between gap-4 text-sm">
                            <div className="min-w-0">
                              <div className="font-medium truncate">
                                {u.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {u.branch} • {u.count} advance{u.count !== 1 ? "s" : ""}
                              </div>
                            </div>
                            <div className="font-bold text-orange-600 whitespace-nowrap">
                              {formatCurrency(u.amount)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

