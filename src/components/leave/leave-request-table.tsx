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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
} from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { LeaveRequest } from "@/models/models";
import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { DownloadLeaveReport } from "@/components/leave-requests/download-leave-report";


interface LeaveRequestTableProps {
  requests: LeaveRequest[];
  showBranch?: boolean;
  userRole: string;
  userId: string;
}

function toDate(value: unknown): Date {
  // RSC serialization may turn Date into string; normalize defensively
  return value instanceof Date ? value : new Date(value as string);
}

function getDepartmentName(request: LeaveRequest) {
  return request.user?.department?.name ?? "-";
}

function stringToHue(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

function DepartmentPill({ name }: { name: string }) {
  if (!name || name === "-") return <span className="text-muted-foreground">-</span>;
  const hue = stringToHue(name);
  const bg = `hsl(${hue} 80% 92%)`;
  const text = `hsl(${hue} 45% 25%)`;
  const border = `hsl(${hue} 60% 80%)`;
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: bg, color: text, borderColor: border }}
      title={name}
    >
      {name}
    </span>
  );
}

function getRequestStatusClass(status: string) {
  if (status === "APPROVED") return "bg-green-100 text-green-900 border-green-200";
  if (status === "REJECTED") return "bg-red-100 text-red-900 border-red-200";
  return "bg-yellow-100 text-yellow-900 border-yellow-200";
}

export function LeaveRequestTable({ 
  requests, 
  showBranch = false,
  userRole,
  userId,
}: LeaveRequestTableProps) {
  const router = useRouter();
  const canReview = ["MANAGEMENT", "HR"].includes(userRole);
  const [timeRange, setTimeRange] = React.useState<"current_future" | "past">("current_future");
  const [view, setView] = React.useState<"table" | "calendar">("table");
  const [month, setMonth] = React.useState<Date>(() => startOfMonth(new Date()));
  const [dayDialogOpen, setDayDialogOpen] = React.useState(false);
  const [dialogDay, setDialogDay] = React.useState<Date>(() => startOfDay(new Date()));
  const [branchFilter, setBranchFilter] = React.useState<string>("ALL");
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("ALL");
  const [startDateFilter, setStartDateFilter] = React.useState<Date>(() =>
    startOfYear(new Date())
  );
  const [endDateFilter, setEndDateFilter] = React.useState<Date>(() =>
    endOfYear(new Date())
  );

  React.useEffect(() => {
    // avoid confusing "empty" states when switching time ranges
    setBranchFilter("ALL");
    setDepartmentFilter("ALL");
  }, [timeRange]);

  const viewStorageKey = React.useMemo(() => `leave-requests:view:${userId}`, [userId]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(viewStorageKey);
      if (saved === "table" || saved === "calendar") {
        setView(saved);
      }
    } catch {
      // ignore storage read errors
    }
  }, [viewStorageKey]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(viewStorageKey, view);
    } catch {
      // ignore storage write errors
    }
  }, [view, viewStorageKey]);

  const handleStatusUpdate = async (requestId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/leave-requests/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update leave request");
      }

      toast.success("Leave request updated successfully");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update leave request");
    }
  };

  const statusColors = {
    PENDING: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
  } as const;

  const baseRequests = React.useMemo(() => {
    const today = startOfDay(new Date());
    if (timeRange === "past") {
      return requests.filter((req) => startOfDay(toDate(req.endDate)) < today);
    }
    // current + future (end date is today or later)
    return requests.filter((req) => startOfDay(toDate(req.endDate)) >= today);
  }, [requests, timeRange]);

  const branchOptions = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const req of baseRequests) {
      const b = req.user?.branch;
      if (b?.id && b?.name) map.set(b.id, { id: b.id, name: b.name });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [baseRequests]);

  const departmentOptions = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const req of baseRequests) {
      const d = req.user?.department;
      if (d?.id && d?.name) map.set(d.id, { id: d.id, name: d.name });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [baseRequests]);

  const filteredRequests = React.useMemo(() => {
    const filterStart = startOfDay(startDateFilter);
    const filterEnd = startOfDay(endDateFilter);
    return baseRequests.filter((req) => {
      const reqStart = startOfDay(toDate(req.startDate));
      const reqEnd = startOfDay(toDate(req.endDate));
      const dateOk = reqStart <= filterEnd && reqEnd >= filterStart;
      const branchId = req.user?.branch?.id ?? "";
      const deptId = req.user?.department?.id ?? "";
      const branchOk = branchFilter === "ALL" ? true : branchId === branchFilter;
      const deptOk = departmentFilter === "ALL" ? true : deptId === departmentFilter;
      return dateOk && branchOk && deptOk;
    });
  }, [baseRequests, branchFilter, departmentFilter, startDateFilter, endDateFilter]);

  const daysInView = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const requestsByDayKey = React.useMemo(() => {
    const map = new Map<string, LeaveRequest[]>();
    for (const req of filteredRequests) {
      const start = startOfDay(toDate(req.startDate));
      const end = startOfDay(toDate(req.endDate));
      const days = eachDayOfInterval({ start, end });
      for (const day of days) {
        const key = format(day, "yyyy-MM-dd");
        const existing = map.get(key);
        if (existing) existing.push(req);
        else map.set(key, [req]);
      }
    }
    // stable-ish ordering: pending first, then approved, then rejected, then by employee
    const priority: Record<string, number> = { PENDING: 0, APPROVED: 1, REJECTED: 2 };
    for (const [k, list] of map.entries()) {
      map.set(
        k,
        list.slice().sort((a, b) => {
          const pa = priority[a.status] ?? 99;
          const pb = priority[b.status] ?? 99;
          if (pa !== pb) return pa - pb;
          const na = a.user?.name ?? "";
          const nb = b.user?.name ?? "";
          return na.localeCompare(nb);
        })
      );
    }
    return map;
  }, [filteredRequests]);

  const dialogRequests = React.useMemo(() => {
    const key = format(startOfDay(dialogDay), "yyyy-MM-dd");
    return requestsByDayKey.get(key) ?? [];
  }, [dialogDay, requestsByDayKey]);

  const openDayDialog = (day: Date) => {
    setDialogDay(startOfDay(day));
    setDayDialogOpen(true);
  };

  return (
    <div className="p-3">
      <div className="space-y-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={timeRange}
            onValueChange={(v) => setTimeRange(v as "current_future" | "past")}
            className="w-auto"
          >
            <TabsList>
              <TabsTrigger value="current_future">Current + Future</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
            </TabsList>
          </Tabs>

          <Tabs value={view} onValueChange={(v) => setView(v as "table" | "calendar")} className="w-auto">
            <TabsList>
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    "text-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(startDateFilter, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDateFilter}
                  onSelect={(d) => d && setStartDateFilter(startOfDay(d))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    "text-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(endDateFilter, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDateFilter}
                  onSelect={(d) => d && setEndDateFilter(startOfDay(d))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <div className="w-[220px]">
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All branches</SelectItem>
                  {branchOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[240px]">
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All departments</SelectItem>
                  {departmentOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-foreground">{filteredRequests.length}</span> of{" "}
              <span className="font-medium text-foreground">{baseRequests.length}</span>
            </div>

            {canReview && (
              <DownloadLeaveReport
                filters={{
                  startDate: format(startDateFilter, "yyyy-MM-dd"),
                  endDate: format(endDateFilter, "yyyy-MM-dd"),
                  branchId: branchFilter === "ALL" ? undefined : branchFilter,
                  departmentId: departmentFilter === "ALL" ? undefined : departmentFilter,
                }}
              />
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-yellow-400" />
              Pending
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Approved
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Rejected
            </span>
          </div>
        </div>
      </div>

      {view === "table" ? (
        <Table className="mt-3">
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              {showBranch && <TableHead>Branch</TableHead>}
              <TableHead>Department</TableHead>
              <TableHead>Leave Type</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              {canReview && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>{request.user?.name ?? "-"}</TableCell>
                {showBranch && (
                  <TableCell>{request.user?.branch?.name || "-"}</TableCell>
                )}
                <TableCell>
                  <DepartmentPill name={getDepartmentName(request)} />
                </TableCell>
                <TableCell>{request.leaveType}</TableCell>
                <TableCell>{format(toDate(request.startDate), "PPP")}</TableCell>
                <TableCell>{format(toDate(request.endDate), "PPP")}</TableCell>
                <TableCell className="max-w-[320px] truncate">{request.reason}</TableCell>
                <TableCell>
                  <Badge className={statusColors[request.status as keyof typeof statusColors]}>
                    {request.status}
                  </Badge>
                </TableCell>
                {canReview && (
                  <TableCell>
                    {request.status === "PENDING" && (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-green-100 hover:bg-green-200 text-green-800"
                          onClick={() => handleStatusUpdate(request.id, "APPROVED")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-red-100 hover:bg-red-200 text-red-800"
                          onClick={() => handleStatusUpdate(request.id, "REJECTED")}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-lg font-semibold">{format(month, "MMMM yyyy")}</div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setMonth(startOfMonth(new Date()))}>
                Today
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMonth((m) => subMonths(m, 1))}>
                Prev
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMonth((m) => addMonths(m, 1))}>
                Next
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 rounded-md border">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}

            {daysInView.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const items = requestsByDayKey.get(key) ?? [];
              const maxVisible = 3;
              const visible = items.slice(0, maxVisible);
              const overflow = items.length - visible.length;
              const inMonth = isSameMonth(day, month);
              const isToday = isSameDay(day, new Date());

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => openDayDialog(day)}
                  className={cn(
                    "group relative min-h-[130px] w-full border-t p-2 text-left transition-colors hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    !inMonth && "bg-muted/30 text-muted-foreground",
                    isToday && "bg-accent/30"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className={cn("text-sm font-medium", !inMonth && "opacity-70")}>
                      {format(day, "d")}
                    </div>
                    {items.length > 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        {items.length} item{items.length === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 space-y-1">
                    {visible.map((req) => (
                      <div
                        key={req.id}
                        className={cn(
                          "truncate rounded border px-2 py-1 text-xs",
                          getRequestStatusClass(req.status)
                        )}
                        title={`${req.user?.name ?? "-"} • ${getDepartmentName(req)} • ${req.leaveType}`}
                        onClick={(e) => {
                          // keep cell click behavior (open dialog), but don't double-trigger focus quirks
                          e.stopPropagation();
                          openDayDialog(day);
                        }}
                      >
                        <span className="font-medium">{req.user?.name ?? "-"}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          • {getDepartmentName(req) !== "-" ? getDepartmentName(req) : "No dept"}
                        </span>
                      </div>
                    ))}

                    {overflow > 0 && (
                      <div
                        className="w-fit text-xs font-medium text-primary underline-offset-4 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDayDialog(day);
                        }}
                      >
                        +{overflow} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{format(dialogDay, "PPP")}</DialogTitle>
                <DialogDescription>
                  {dialogRequests.length} item{dialogRequests.length === 1 ? "" : "s"} (filtered by branch/department)
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[70vh] space-y-2 overflow-auto pr-1">
                {dialogRequests.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No leave requests for this day.</div>
                ) : (
                  dialogRequests.map((request) => (
                    <div key={request.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-medium">{request.user?.name ?? "-"}</div>
                            <DepartmentPill name={getDepartmentName(request)} />
                            {showBranch && (
                              <span className="text-xs text-muted-foreground">
                                Branch: {request.user?.branch?.name ?? "-"}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {request.leaveType} • {format(toDate(request.startDate), "PPP")} →{" "}
                            {format(toDate(request.endDate), "PPP")}
                          </div>
                          <div className="mt-2 text-sm">{request.reason}</div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <Badge className={statusColors[request.status as keyof typeof statusColors]}>
                            {request.status}
                          </Badge>

                          {canReview && request.status === "PENDING" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-green-100 hover:bg-green-200 text-green-800"
                                onClick={() => handleStatusUpdate(request.id, "APPROVED")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-red-100 hover:bg-red-200 text-red-800"
                                onClick={() => handleStatusUpdate(request.id, "REJECTED")}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
} 
