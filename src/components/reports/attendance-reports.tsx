"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Clock, CheckCircle, XCircle, Users } from "lucide-react";
import { format } from "date-fns";

interface AttendanceReportsProps {
  userRole: string;
}

interface AttendanceStats {
  totalEmployees: number;
  presentCount: number;
  absentCount: number;
  halfDayCount: number;
  overtimeCount: number;
  averageAttendance: number;
  attendanceByBranch: Array<{
    branch: string;
    present: number;
    absent: number;
    total: number;
    percentage: number;
  }>;
  attendanceTrend: Array<{
    date: string;
    present: number;
    absent: number;
  }>;
}

export function AttendanceReports({ userRole }: AttendanceReportsProps) {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [branch, setBranch] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [branches, setBranches] = useState<string[]>([]);

  const fetchAttendanceReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: month.toString(),
        year: year.toString(),
        branch: branch,
      });

      const response = await fetch(`/api/reports/attendance?${params}`);
      if (!response.ok) throw new Error("Failed to fetch attendance report");
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching attendance report:", error);
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
    fetchAttendanceReport();
  }, [month, year, branch]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        month: month.toString(),
        year: year.toString(),
        branch: branch,
        format: "excel",
      });

      const response = await fetch(`/api/reports/attendance/export?${params}`);
      if (!response.ok) throw new Error("Failed to export report");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-report-${month}-${year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error exporting report:", error);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Attendance Reports</CardTitle>
              <CardDescription>
                Comprehensive attendance analytics and insights
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

            <Button onClick={fetchAttendanceReport} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>

          {stats && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalEmployees}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Present</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{stats.presentCount}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.totalEmployees > 0
                        ? ((stats.presentCount / stats.totalEmployees) * 100).toFixed(1)
                        : 0}% attendance rate
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Absent</CardTitle>
                    <XCircle className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{stats.absentCount}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Overtime Days</CardTitle>
                    <Clock className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">{stats.overtimeCount}</div>
                  </CardContent>
                </Card>
              </div>

              {stats.attendanceByBranch.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Attendance by Branch</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stats.attendanceByBranch.map((branchStat) => (
                        <div key={branchStat.branch} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{branchStat.branch}</span>
                            <span>{branchStat.percentage.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${branchStat.percentage}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Present: {branchStat.present}</span>
                            <span>Absent: {branchStat.absent}</span>
                            <span>Total: {branchStat.total}</span>
                          </div>
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

