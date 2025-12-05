"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export function UniformReports({ userRole }: UniformReportsProps) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [branch, setBranch] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<UniformStats | null>(null);
  const [branches, setBranches] = useState<string[]>([]);

  const fetchUniformReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: year.toString(),
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
    // Fetch branches
    if (userRole !== "BRANCH_MANAGER") {
      fetch("/api/reports/branches")
        .then((res) => res.json())
        .then((data) => setBranches(data))
        .catch((err) => console.error("Error fetching branches:", err));
    }
  }, [userRole]);

  useEffect(() => {
    fetchUniformReport();
  }, [year, branch]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        year: year.toString(),
        branch: branch,
        format: "excel",
      });

      const response = await fetch(`/api/reports/uniform/export?${params}`);
      if (!response.ok) throw new Error("Failed to export report");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `uniform-report-${year}.xlsx`;
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
              <CardTitle>Uniform Reports</CardTitle>
              <CardDescription>
                Uniform tracking and inventory management
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

            <Button onClick={fetchUniformReport} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </Button>
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

