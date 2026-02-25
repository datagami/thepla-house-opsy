"use client";

import { useState, useEffect } from "react";
import { format, subMonths, startOfYear, startOfDay } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Download, Shirt, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface UniformReportsProps {
  userRole: string;
}

interface UniformStats {
  totalIssued: number;
  totalReturned: number;
  totalLost: number;
  totalDamaged: number;
  uniformsByStatus: Array<{
    status: string;
    count: number;
  }>;
  uniformsByType: Array<{
    type: string;
    count: number;
  }>;
  recentIssues: Array<{
    employeeName: string;
    itemName: string;
    itemType: string;
    issuedAt: string;
    status: string;
  }>;
}

const today = () => startOfDay(new Date());

export function UniformReports({ userRole }: UniformReportsProps) {
  const [startDate, setStartDate] = useState<Date>(() => startOfDay(subMonths(new Date(), 6)));
  const [endDate, setEndDate] = useState<Date>(() => today());
  const [branch, setBranch] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<UniformStats | null>(null);
  const [branches, setBranches] = useState<string[]>([]);

  const isRangeValid = startDate && endDate && endDate >= startDate;

  const fetchUniformReport = async () => {
    if (!isRangeValid) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
        branch: branch,
      });

      const response = await fetch(`/api/reports/uniform?${params}`);
      if (!response.ok) throw new Error("Failed to fetch uniform report");

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching uniform report:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole !== "BRANCH_MANAGER") {
      fetch("/api/reports/branches")
        .then((res) => res.json())
        .then((data) => setBranches(data))
        .catch((err) => console.error("Error fetching branches:", err));
    }
  }, [userRole]);

  useEffect(() => {
    if (isRangeValid) fetchUniformReport();
  }, [startDate, endDate, branch]);

  const handleExport = async () => {
    if (!isRangeValid) return;
    try {
      const params = new URLSearchParams({
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
        branch: branch,
        format: "excel",
      });

      const response = await fetch(`/api/reports/uniform/export?${params}`);
      if (!response.ok) throw new Error("Failed to export report");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `uniform-report-${format(startDate, "yyyy-MM-dd")}-to-${format(endDate, "yyyy-MM-dd")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error exporting report:", error);
    }
  };

  const setPresetLast6Months = () => {
    setStartDate(startOfDay(subMonths(new Date(), 6)));
    setEndDate(today());
  };
  const setPresetLast1Year = () => {
    setStartDate(startOfDay(subMonths(new Date(), 12)));
    setEndDate(today());
  };
  const setPresetYearToDate = () => {
    setStartDate(startOfYear(new Date()));
    setEndDate(today());
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Uniform Reports</CardTitle>
              <CardDescription>
                Uniform tracking and inventory management
              </CardDescription>
            </div>
            <Button onClick={handleExport} variant="outline" size="sm" disabled={!isRangeValid}>
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">From</label>
                <DatePicker
                  date={startDate}
                  onSelect={(d) => d && setStartDate(startOfDay(d))}
                  placeholder="Start date"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">To</label>
                <DatePicker
                  date={endDate}
                  onSelect={(d) => d && setEndDate(startOfDay(d))}
                  placeholder="End date"
                />
              </div>
              {userRole !== "BRANCH_MANAGER" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Branch</label>
                  <Select value={branch} onValueChange={setBranch}>
                    <SelectTrigger className="w-[180px]">
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
                </div>
              )}
              <Button onClick={fetchUniformReport} disabled={loading || !isRangeValid}>
                {loading ? "Loading..." : "Refresh"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={setPresetLast6Months}>
                Last 6 months
              </Button>
              <Button variant="ghost" size="sm" onClick={setPresetLast1Year}>
                Last 1 year
              </Button>
              <Button variant="ghost" size="sm" onClick={setPresetYearToDate}>
                Year to date
              </Button>
            </div>
            {startDate && endDate && endDate < startDate && (
              <p className="text-sm text-destructive">End date must be on or after start date.</p>
            )}
          </div>

          {stats && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Issued</CardTitle>
                    <Shirt className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{stats.totalIssued}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Returned</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{stats.totalReturned}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Lost</CardTitle>
                    <XCircle className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{stats.totalLost}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Damaged</CardTitle>
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">{stats.totalDamaged}</div>
                  </CardContent>
                </Card>
              </div>

              {stats.uniformsByType.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Uniforms by Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {stats.uniformsByType.map((type) => (
                        <div key={type.type} className="flex justify-between">
                          <span>{type.type}</span>
                          <span className="font-bold">{type.count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

