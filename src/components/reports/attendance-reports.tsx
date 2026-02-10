"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Clock, CheckCircle, Users, TrendingUp, AlertTriangle, Award } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from "recharts";

interface AttendanceReportsProps {
  userRole: string;
}

interface AttendanceStats {
  totalEmployees: number;
  totalDaysInMonth: number;
  daysToCount: number;
  isCurrentMonth: boolean;
  totalPresentDays: number;
  totalAbsentDays: number;
  totalHalfDays: number;
  totalOvertimeDays: number;
  averageAttendanceRate: number;
  avgPresentDaysPerEmployee: number;
  attendanceByBranch: Array<{
    branch: string;
    employees: number;
    presentDays: number;
    absentDays: number;
    halfDays: number;
    overtimeDays: number;
    attendanceRate: number;
    avgPresentDays: number;
  }>;
  attendanceTrend: Array<{
    date: string;
    present: number;
    absent: number;
    total: number;
    rate: number;
  }>;
  attendanceTrend6Months?: Array<{
    month: string;
    rate: number;
    presentDays: number;
    totalPossible: number;
  }>;
  topPerformers: Array<{
    name: string;
    presentDays: number;
    absentDays: number;
    attendanceRate: number;
  }>;
  lowAttendanceEmployees: Array<{
    name: string;
    branch: string;
    presentDays: number;
    absentDays: number;
    attendanceRate: number;
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
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        toast.error(err?.error ?? "Failed to export report");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-report-${month}-${year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Attendance report downloaded successfully");
    } catch (error) {
      console.error("Error exporting report:", error);
      toast.error(error instanceof Error ? error.message : "Failed to export report");
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
              {/* Key Metrics */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalEmployees}</div>
                    <p className="text-xs text-muted-foreground">
                      Active employees
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Attendance Rate</CardTitle>
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {stats.averageAttendanceRate.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {stats.avgPresentDaysPerEmployee.toFixed(1)} days avg per employee
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Present Days</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {stats.totalPresentDays.toFixed(0)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {stats.totalAbsentDays} absent days
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Overtime Days</CardTitle>
                    <Clock className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {stats.totalOvertimeDays}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {stats.totalHalfDays} half days
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Daily attendance trend (selected month) */}
              {stats.attendanceTrend.length > 0 && stats.attendanceTrend.some((d) => d.total > 0) ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Daily attendance rate</CardTitle>
                    <CardDescription>
                      Day-wise attendance rate for {format(new Date(year, month - 1, 1), "MMMM yyyy")} — {branch === "ALL" ? "All Branches" : branch}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={stats.attendanceTrend.map((d, i, arr) => {
                            const prevRate = i > 0 ? arr[i - 1].rate : null;
                            const rateChangePp = prevRate != null ? d.rate - prevRate : null;
                            const rateChangeLabel =
                              rateChangePp == null ? "—" : (rateChangePp >= 0 ? "+" : "") + rateChangePp.toFixed(1) + "pp";
                            return {
                              ...d,
                              dateLabel: format(new Date(d.date), "d MMM"),
                              rateChangeLabel,
                            };
                          })}
                          margin={{ top: 28, right: 10, left: 0, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const p = payload[0].payload as { date: string; rate: number; present: number; absent: number; total: number };
                              return (
                                <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
                                  <div className="font-medium">{format(new Date(p.date), "d MMM yyyy")}</div>
                                  <div className="text-muted-foreground mt-1">
                                    Rate: {p.rate.toFixed(1)}% · Present: {p.present} · Absent: {p.absent}
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="rate"
                            name="rate"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          >
                            <LabelList dataKey="rateChangeLabel" position="top" style={{ fontSize: 10 }} className="fill-muted-foreground" />
                          </Line>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                stats.attendanceTrend.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Daily attendance rate</CardTitle>
                      <CardDescription>
                        Day-wise attendance for {format(new Date(year, month - 1, 1), "MMMM yyyy")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground py-8 text-center">
                        No data for the selected period
                      </p>
                    </CardContent>
                  </Card>
                )
              )}

              {/* 6-month attendance trend */}
              {stats.attendanceTrend6Months && stats.attendanceTrend6Months.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Attendance trend (last 6 months)</CardTitle>
                    <CardDescription>
                      Monthly average attendance rate — {branch === "ALL" ? "All Branches" : branch}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {stats.attendanceTrend6Months.some((d) => d.totalPossible > 0) ? (
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={stats.attendanceTrend6Months.map((d, i, arr) => {
                              const prevRate = i > 0 ? arr[i - 1].rate : null;
                              const rateChangePp = prevRate != null ? d.rate - prevRate : null;
                              const rateChangeLabel =
                                rateChangePp == null ? "—" : (rateChangePp >= 0 ? "+" : "") + rateChangePp.toFixed(1) + "pp";
                              const [m, y] = d.month.split("/").map(Number);
                              return {
                                ...d,
                                monthLabel: format(new Date(y, m - 1, 1), "MMM yyyy"),
                                rateChangeLabel,
                              };
                            })}
                            margin={{ top: 28, right: 10, left: 0, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                            <Tooltip
                              formatter={(value: number) => [`${value}%`, "Rate"]}
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const p = payload[0].payload as { month: string; rate: number; presentDays: number; totalPossible: number; monthLabel: string };
                                return (
                                  <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
                                    <div className="font-medium">{p.monthLabel}</div>
                                    <div className="text-muted-foreground mt-1">
                                      Rate: {p.rate}% · Present: {p.presentDays} / {p.totalPossible} days
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="rate"
                              name="Rate"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                            >
                              <LabelList dataKey="rateChangeLabel" position="top" style={{ fontSize: 11 }} className="fill-muted-foreground" />
                            </Line>
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-8 text-center">
                        No data for the selected period
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Attendance by Branch */}
              {stats.attendanceByBranch.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Attendance by Branch</CardTitle>
                    <CardDescription>
                      Branch-wise attendance breakdown for {format(new Date(year, month - 1, 1), "MMMM yyyy")}
                      {stats.isCurrentMonth && (
                        <span className="text-muted-foreground ml-1">
                          (Based on {stats.daysToCount} days so far)
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stats.attendanceByBranch.map((branchStat) => (
                        <div key={branchStat.branch} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-medium">{branchStat.branch}</span>
                              <span className="text-sm text-muted-foreground ml-2">
                                ({branchStat.employees} employees)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={branchStat.attendanceRate >= 90 ? "default" : branchStat.attendanceRate >= 80 ? "secondary" : "destructive"}
                              >
                                {branchStat.attendanceRate.toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                branchStat.attendanceRate >= 90 
                                  ? "bg-green-600" 
                                  : branchStat.attendanceRate >= 80 
                                  ? "bg-yellow-600" 
                                  : "bg-red-600"
                              }`}
                              style={{ width: `${Math.min(branchStat.attendanceRate, 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Present: {branchStat.presentDays.toFixed(1)} days</span>
                            <span>Absent: {branchStat.absentDays} days</span>
                            <span>Avg: {branchStat.avgPresentDays.toFixed(1)} days/employee</span>
                            {branchStat.overtimeDays > 0 && (
                              <span>OT: {branchStat.overtimeDays} days</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top Performers */}
              {stats.topPerformers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-yellow-600" />
                      Top Performers
                    </CardTitle>
                    <CardDescription>
                      Employees with highest attendance rates
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Present Days</TableHead>
                          <TableHead>Absent Days</TableHead>
                          <TableHead className="text-right">Attendance Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.topPerformers.map((emp, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{emp.name}</TableCell>
                            <TableCell>{emp.presentDays.toFixed(1)}</TableCell>
                            <TableCell>{emp.absentDays}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="default">{emp.attendanceRate.toFixed(1)}%</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Low Attendance Alert */}
              {stats.lowAttendanceEmployees.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      Low Attendance Alert
                    </CardTitle>
                    <CardDescription>
                      Employees with attendance below 80%
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Branch</TableHead>
                          <TableHead>Present Days</TableHead>
                          <TableHead>Absent Days</TableHead>
                          <TableHead className="text-right">Attendance Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.lowAttendanceEmployees.map((emp, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{emp.name}</TableCell>
                            <TableCell>{emp.branch}</TableCell>
                            <TableCell>{emp.presentDays.toFixed(1)}</TableCell>
                            <TableCell>{emp.absentDays}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="destructive">{emp.attendanceRate.toFixed(1)}%</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
