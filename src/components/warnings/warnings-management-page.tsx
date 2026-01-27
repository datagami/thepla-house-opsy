"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatDateOnly } from "@/lib/utils";
import { Download, Filter, AlertTriangle, Archive, TrendingUp, Building2 } from "lucide-react";
import { toast } from "sonner";

interface Branch {
  id: string;
  name: string;
}

interface WarningType {
  id: string;
  name: string;
}

interface Warning {
  id: string;
  createdAt: string;
  isArchived: boolean;
  archivedAt?: string | null;
  reason: string;
  photoUrl?: string | null;
  user: {
    id: string;
    name: string | null;
    numId: number;
    email: string | null;
    branch: { id: string; name: string } | null;
  };
  reportedBy: { id: string; name: string | null } | null;
  archivedBy: { id: string; name: string | null } | null;
  warningType: { id: string; name: string; description: string | null } | null;
}

interface Stats {
  totalWarnings: number;
  activeWarnings: number;
  archivedWarnings: number;
  warningsByType: Array<{ warningTypeId: string | null; warningTypeName: string; count: number }>;
  warningsByBranch: Array<{ branchId: string; branchName: string; count: number }>;
}

interface WarningsManagementPageProps {
  branches: Branch[];
  warningTypes: WarningType[];
  userRole: string;
}

export function WarningsManagementPage({ branches, warningTypes, userRole }: WarningsManagementPageProps) {
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Filters
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [warningTypeFilter, setWarningTypeFilter] = useState("ALL");
  const [archivedFilter, setArchivedFilter] = useState("false");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchWarnings();
  }, [branchFilter, warningTypeFilter, archivedFilter, startDate, endDate]);

  useEffect(() => {
    fetchStats();
  }, [startDate, endDate]);

  async function fetchWarnings() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (branchFilter !== "ALL") params.append("branchId", branchFilter);
      if (warningTypeFilter !== "ALL") params.append("warningTypeId", warningTypeFilter);
      if (archivedFilter !== "ALL") params.append("isArchived", archivedFilter);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const response = await fetch(`/api/warnings?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch warnings");
      
      const data = await response.json();
      setWarnings(data);
    } catch (error) {
      console.error("Error fetching warnings:", error);
      toast.error("Failed to load warnings");
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      setStatsLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const response = await fetch(`/api/warnings/stats?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch statistics");
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Failed to load statistics");
    } finally {
      setStatsLoading(false);
    }
  }

  function exportToCSV() {
    const headers = ["Date", "Employee", "Emp No.", "Branch", "Warning Type", "Notes", "Reported By", "Status"];
    const rows = filteredWarnings.map(w => [
      formatDateOnly(w.createdAt),
      w.user.name || "",
      w.user.numId || "",
      w.user.branch?.name || "",
      w.warningType?.name || "",
      w.reason || "",
      w.reportedBy?.name || "",
      w.isArchived ? "Archived" : "Active",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `warnings-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  const filteredWarnings = warnings.filter(w => {
    const matchesSearch = 
      !searchQuery ||
      w.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.user.numId?.toString().includes(searchQuery) ||
      w.warningType?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Warnings Management</h2>
          <p className="text-muted-foreground">View and manage employee warnings across the organization</p>
        </div>
        <Button onClick={exportToCSV} disabled={filteredWarnings.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="warnings">All Warnings</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Warnings</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsLoading ? "..." : stats?.totalWarnings || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Warnings</CardTitle>
                <TrendingUp className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{statsLoading ? "..." : stats?.activeWarnings || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Archived</CardTitle>
                <Archive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsLoading ? "..." : stats?.archivedWarnings || 0}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Warnings by Type</CardTitle>
                <CardDescription>Distribution of warning types</CardDescription>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : (
                  <div className="space-y-2">
                    {stats?.warningsByType.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm">{item.warningTypeName}</span>
                        <Badge variant="secondary">{item.count}</Badge>
                      </div>
                    ))}
                    {(!stats?.warningsByType || stats.warningsByType.length === 0) && (
                      <p className="text-sm text-muted-foreground">No data available</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Warnings by Branch</CardTitle>
                <CardDescription>Distribution across branches</CardDescription>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : (
                  <div className="space-y-2">
                    {stats?.warningsByBranch.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{item.branchName}</span>
                        </div>
                        <Badge variant="secondary">{item.count}</Badge>
                      </div>
                    ))}
                    {(!stats?.warningsByBranch || stats.warningsByBranch.length === 0) && (
                      <p className="text-sm text-muted-foreground">No data available</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="warnings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search</label>
                  <Input
                    placeholder="Employee name, email, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {userRole !== "BRANCH_MANAGER" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Branch</label>
                    <Select value={branchFilter} onValueChange={setBranchFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Branches" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Branches</SelectItem>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Warning Type</label>
                  <Select value={warningTypeFilter} onValueChange={setWarningTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      {warningTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={archivedFilter} onValueChange={setArchivedFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      <SelectItem value="false">Active</SelectItem>
                      <SelectItem value="true">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Warning Type</TableHead>
                  <TableHead>Reported By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : filteredWarnings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No warnings found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWarnings.map((warning) => (
                    <TableRow key={warning.id}>
                      <TableCell>{formatDateOnly(warning.createdAt)}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{warning.user.name}</div>
                          <div className="text-sm text-muted-foreground">#{warning.user.numId}</div>
                        </div>
                      </TableCell>
                      <TableCell>{warning.user.branch?.name || "-"}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{warning.warningType?.name || "N/A"}</div>
                          {warning.reason && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {warning.reason.substring(0, 50)}{warning.reason.length > 50 ? "..." : ""}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{warning.reportedBy?.name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={warning.isArchived ? "secondary" : "default"}>
                          {warning.isArchived ? "Archived" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/users/${warning.user.id}/warnings`, "_blank")}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Warning Reports</CardTitle>
              <CardDescription>Comprehensive warning analytics and insights</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Summary Statistics</h3>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Total Warnings</p>
                    <p className="text-2xl font-bold">{stats?.totalWarnings || 0}</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold text-orange-600">{stats?.activeWarnings || 0}</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Archived</p>
                    <p className="text-2xl font-bold text-gray-600">{stats?.archivedWarnings || 0}</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Archive Rate</p>
                    <p className="text-2xl font-bold">
                      {stats?.totalWarnings 
                        ? Math.round((stats.archivedWarnings / stats.totalWarnings) * 100) 
                        : 0}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button onClick={exportToCSV} disabled={warnings.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Full Report (CSV)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
