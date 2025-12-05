"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Users, UserPlus, UserMinus } from "lucide-react";

interface EmployeeReportsProps {
  userRole: string;
}

interface EmployeeStats {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  pendingEmployees: number;
  employeesByBranch: Array<{
    branch: string;
    count: number;
  }>;
  employeesByDepartment: Array<{
    department: string;
    count: number;
  }>;
  employeesByRole: Array<{
    role: string;
    count: number;
  }>;
  newHires: Array<{
    name: string;
    doj: string;
    branch: string;
  }>;
}

export function EmployeeReports({ userRole }: EmployeeReportsProps) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [branch, setBranch] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [branches, setBranches] = useState<string[]>([]);

  const fetchEmployeeReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: year.toString(),
        branch: branch,
      });

      const response = await fetch(`/api/reports/employee?${params}`);
      if (!response.ok) throw new Error("Failed to fetch employee report");
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching employee report:", error);
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
    fetchEmployeeReport();
  }, [year, branch]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        year: year.toString(),
        branch: branch,
        format: "excel",
      });

      const response = await fetch(`/api/reports/employee/export?${params}`);
      if (!response.ok) throw new Error("Failed to export report");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `employee-report-${year}.xlsx`;
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
              <CardTitle>Employee Reports</CardTitle>
              <CardDescription>
                Employee headcount, distribution, and demographics
              </CardDescription>
            </div>
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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

            <Button onClick={fetchEmployeeReport} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>

          {stats && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
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
                    <CardTitle className="text-sm font-medium">Active</CardTitle>
                    <UserPlus className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{stats.activeEmployees}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Inactive</CardTitle>
                    <UserMinus className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{stats.inactiveEmployees}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">{stats.pendingEmployees}</div>
                  </CardContent>
                </Card>
              </div>

              {stats.employeesByBranch.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Employees by Branch</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {stats.employeesByBranch.map((branch) => (
                        <div key={branch.branch} className="flex justify-between">
                          <span>{branch.branch}</span>
                          <span className="font-bold">{branch.count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {stats.employeesByDepartment.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Employees by Department</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {stats.employeesByDepartment.map((dept) => (
                        <div key={dept.department} className="flex justify-between">
                          <span>{dept.department || "Not Assigned"}</span>
                          <span className="font-bold">{dept.count}</span>
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

