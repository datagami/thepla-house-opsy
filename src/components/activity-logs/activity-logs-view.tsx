"use client";

import { useState, useEffect } from "react";
import { ActivityType } from "@prisma/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityLog {
  id: string;
  activityType: ActivityType;
  userId: string | null;
  targetUserId: string | null;
  targetId: string | null;
  entityType: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  } | null;
  targetUser: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  } | null;
}

interface ActivityLogsResponse {
  logs: ActivityLog[];
  total: number;
  limit: number;
  offset: number;
}

const activityTypeLabels: Record<ActivityType, string> = {
  USER_CREATED: "User Created",
  USER_UPDATED: "User Updated",
  USER_DELETED: "User Deleted",
  USER_STATUS_CHANGED: "User Status Changed",
  USER_ROLE_CHANGED: "User Role Changed",
  USER_BRANCH_ASSIGNED: "User Branch Assigned",
  USER_APPROVED: "User Approved",
  ATTENDANCE_CREATED: "Attendance Created",
  ATTENDANCE_UPDATED: "Attendance Updated",
  ATTENDANCE_VERIFIED: "Attendance Verified",
  ATTENDANCE_REJECTED: "Attendance Rejected",
  LEAVE_REQUEST_CREATED: "Leave Request Created",
  LEAVE_REQUEST_APPROVED: "Leave Request Approved",
  LEAVE_REQUEST_REJECTED: "Leave Request Rejected",
  SALARY_GENERATED: "Salary Generated",
  SALARY_UPDATED: "Salary Updated",
  SALARY_STATUS_CHANGED: "Salary Status Changed",
  ADVANCE_PAYMENT_REQUESTED: "Advance Payment Requested",
  ADVANCE_PAYMENT_APPROVED: "Advance Payment Approved",
  ADVANCE_PAYMENT_REJECTED: "Advance Payment Rejected",
  ADVANCE_PAYMENT_SETTLED: "Advance Payment Settled",
  INSTALLMENT_PAID: "Installment Paid",
  UNIFORM_ISSUED: "Uniform Issued",
  UNIFORM_RETURNED: "Uniform Returned",
  DOCUMENT_UPLOADED: "Document Uploaded",
  DOCUMENT_DELETED: "Document Deleted",
  BRANCH_CREATED: "Branch Created",
  BRANCH_UPDATED: "Branch Updated",
  BRANCH_DELETED: "Branch Deleted",
  DEPARTMENT_CREATED: "Department Created",
  DEPARTMENT_UPDATED: "Department Updated",
  DEPARTMENT_DELETED: "Department Deleted",
  NOTE_CREATED: "Note Created",
  NOTE_UPDATED: "Note Updated",
  NOTE_DELETED: "Note Deleted",
  NOTE_SHARED: "Note Shared",
  NOTE_ARCHIVED: "Note Archived",
  LOGIN: "Login",
  LOGOUT: "Logout",
  PASSWORD_CHANGED: "Password Changed",
  OTHER: "Other",
};

const activityTypeColors: Record<string, string> = {
  USER_CREATED: "bg-green-100 text-green-800",
  USER_UPDATED: "bg-blue-100 text-blue-800",
  USER_DELETED: "bg-red-100 text-red-800",
  USER_STATUS_CHANGED: "bg-yellow-100 text-yellow-800",
  USER_ROLE_CHANGED: "bg-purple-100 text-purple-800",
  ATTENDANCE_CREATED: "bg-green-100 text-green-800",
  ATTENDANCE_VERIFIED: "bg-green-100 text-green-800",
  ATTENDANCE_REJECTED: "bg-red-100 text-red-800",
  LEAVE_REQUEST_CREATED: "bg-blue-100 text-blue-800",
  LEAVE_REQUEST_APPROVED: "bg-green-100 text-green-800",
  LEAVE_REQUEST_REJECTED: "bg-red-100 text-red-800",
  SALARY_GENERATED: "bg-green-100 text-green-800",
  ADVANCE_PAYMENT_APPROVED: "bg-green-100 text-green-800",
  ADVANCE_PAYMENT_REJECTED: "bg-red-100 text-red-800",
};

export function ActivityLogsView() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  
  // Filters
  const [activityType, setActivityType] = useState<ActivityType | "ALL">("ALL");
  const [entityType, setEntityType] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [search, setSearch] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activityType !== "ALL") params.append("activityType", activityType);
      if (entityType !== "ALL") params.append("entityType", entityType);
      if (startDate) params.append("startDate", startDate.toISOString());
      if (endDate) params.append("endDate", endDate.toISOString());
      params.append("limit", limit.toString());
      params.append("offset", offset.toString());

      const response = await fetch(`/api/activity-logs?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch logs");
      
      const data: ActivityLogsResponse = await response.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [offset, activityType, entityType, startDate, endDate]);

  const filteredLogs = logs.filter((log) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      log.description.toLowerCase().includes(searchLower) ||
      log.user?.name?.toLowerCase().includes(searchLower) ||
      log.user?.email?.toLowerCase().includes(searchLower) ||
      log.targetUser?.name?.toLowerCase().includes(searchLower) ||
      log.targetUser?.email?.toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const clearFilters = () => {
    setActivityType("ALL");
    setEntityType("ALL");
    setStartDate(undefined);
    setEndDate(undefined);
    setSearch("");
    setOffset(0);
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Activity Logs</h2>
          <p className="text-muted-foreground">
            Immutable ledger of all application activities
          </p>
        </div>
        <Button onClick={fetchLogs} variant="outline" size="sm">
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter activity logs by various criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Activity Type</label>
              <Select value={activityType} onValueChange={(value) => {
                setActivityType(value as ActivityType | "ALL");
                setOffset(0);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  {Object.entries(activityTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Entity Type</label>
              <Select value={entityType} onValueChange={(value) => {
                setEntityType(value);
                setOffset(0);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Entities</SelectItem>
                  <SelectItem value="User">User</SelectItem>
                  <SelectItem value="Attendance">Attendance</SelectItem>
                  <SelectItem value="Salary">Salary</SelectItem>
                  <SelectItem value="LeaveRequest">Leave Request</SelectItem>
                  <SelectItem value="Branch">Branch</SelectItem>
                  <SelectItem value="Department">Department</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      setOffset(0);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      setEndDate(date);
                      setOffset(0);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Input
              placeholder="Search by description, user name, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            {(activityType !== "ALL" || entityType !== "ALL" || startDate || endDate || search) && (
              <Button onClick={clearFilters} variant="outline" size="sm">
                <X className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Logs</CardTitle>
          <CardDescription>
            Showing {filteredLogs.length} of {total} total logs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activity logs found
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Activity Type</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {format(new Date(log.createdAt), "MMM dd, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={activityTypeColors[log.activityType] || "bg-gray-100 text-gray-800"}
                          >
                            {activityTypeLabels[log.activityType] || log.activityType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.user ? (
                            <div>
                              <div className="font-medium">{log.user.name || "Unknown"}</div>
                              <div className="text-xs text-muted-foreground">{log.user.email}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">System</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.targetUser ? (
                            <div>
                              <div className="font-medium">{log.targetUser.name || "Unknown"}</div>
                              <div className="text-xs text-muted-foreground">{log.targetUser.email}</div>
                            </div>
                          ) : log.targetId ? (
                            <span className="text-muted-foreground">{log.entityType}: {log.targetId.slice(0, 8)}...</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="truncate" title={log.description}>
                            {log.description}
                          </div>
                          {log.metadata && (
                            <details className="mt-1">
                              <summary className="text-xs text-muted-foreground cursor-pointer">
                                View metadata
                              </summary>
                              <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-auto max-h-32">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.ipAddress || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages} ({total} total)
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0 || loading}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(offset + limit)}
                    disabled={offset + limit >= total || loading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
