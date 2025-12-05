"use client";

import { format } from "date-fns";
import { Calendar as CalendarIcon, Check, X, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { toast } from "sonner";

interface EmployeeAttendance {
  id: string;
  name: string | null;
  department: { id: string; name: string } | null;
  attendance: Array<{
    id: string;
    status: string;
    isPresent: boolean;
    isHalfDay: boolean;
    overtime: boolean;
    checkIn: string | null;
    checkOut: string | null;
    shift1: boolean;
    shift2: boolean;
    shift3: boolean;
    notes: string | null;
  }>;
}

interface BranchStat {
  branchId: string;
  branchName: string;
  location: string;
  totalEmployees: number;
  submitted: number;
  pending: number;
  approved: number;
  rejected: number;
  present: number;
  absent: number;
  halfDay: number;
  notAdded: number;
  completionPercentage: number;
  employees: EmployeeAttendance[];
}

interface BranchAttendanceSubmissionsProps {
  branchStats: BranchStat[];
  selectedDate: Date;
  userRole: string;
}

export function BranchAttendanceSubmissions({
  branchStats,
  selectedDate,
  userRole,
}: BranchAttendanceSubmissionsProps) {
  const router = useRouter();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      router.push(
        `/hr/branch-attendance?date=${format(date, "yyyy-MM-dd")}`
      );
    }
  };

  const handleVerifyAttendance = async (
    attendanceId: string,
    status: "APPROVED" | "REJECTED"
  ) => {
    setProcessingIds((prev) => new Set(prev).add(attendanceId));
    
    try {
      const response = await fetch(`/api/attendance/${attendanceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          verificationNote: status === "APPROVED" ? "Approved from branch attendance view" : "Rejected from branch attendance view",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to verify attendance");
      }

      toast.success(
        `Attendance ${status === "APPROVED" ? "approved" : "rejected"} successfully`
      );
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to verify attendance");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(attendanceId);
        return next;
      });
    }
  };


  // Calculate overall statistics
  const totalBranches = branchStats.length;
  const totalEmployees = branchStats.reduce(
    (sum, stat) => sum + stat.totalEmployees,
    0
  );
  const totalSubmitted = branchStats.reduce(
    (sum, stat) => sum + stat.submitted,
    0
  );
  const totalPending = branchStats.reduce(
    (sum, stat) => sum + stat.pending,
    0
  );
  const totalApproved = branchStats.reduce(
    (sum, stat) => sum + stat.approved,
    0
  );
  // const totalRejected = branchStats.reduce(
  //   (sum, stat) => sum + stat.rejected,
  //   0
  // );
  const overallCompletion =
    totalEmployees > 0
      ? Math.round((totalSubmitted / totalEmployees) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Branches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBranches}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmployees}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSubmitted}</div>
            <p className="text-xs text-muted-foreground">
              {overallCompletion}% completion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {totalPending}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalApproved}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Picker */}
      <div className="flex items-center gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[240px] justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(selectedDate, "PPP")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) => date > new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Branch Detailed Views */}
      <div className="space-y-6">
        {branchStats.map((stat) => {
          const formatTiming = (employee: EmployeeAttendance) => {
            const attendance = employee.attendance[0];
            if (!attendance || !attendance.isPresent) {
              return "-";
            }
            
            const shifts = [];
            if (attendance.shift1) shifts.push("1st Shift");
            if (attendance.shift2) shifts.push("2nd Shift");
            if (attendance.shift3) shifts.push("3rd Shift");
            
            if (shifts.length === 0) {
              return "-";
            }
            
            return shifts.join(", ");
          };

          const getNotes = (employee: EmployeeAttendance) => {
            const attendance = employee.attendance[0];
            if (!attendance) return null;
            
            const notes = [];
            if (attendance.overtime) notes.push("OT");
            if (attendance.notes) notes.push(attendance.notes);
            
            return notes.length > 0 ? notes.join(", ") : null;
          };

          const getStatusDisplay = (employee: EmployeeAttendance) => {
            const attendance = employee.attendance[0];
            if (!attendance) {
              return (
                <span className="text-muted-foreground font-semibold">NOT ADDED</span>
              );
            }
            if (!attendance.isPresent) {
              return (
                <span className="text-red-600 font-semibold">ABSENT</span>
              );
            }
            return (
              <span className="text-green-600 font-semibold">PRESENT</span>
            );
          };

          return (
            <div key={stat.branchId} className="rounded-md border bg-card">
              {/* Branch Header */}
              <div className="bg-blue-50 border-b px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Link
                      href={`/hr/attendance-verification?date=${format(selectedDate, "yyyy-MM-dd")}&branch=${stat.branchName}`}
                      className="group flex items-center gap-2 hover:underline"
                    >
                      <h3 className="text-lg font-bold text-blue-900 group-hover:text-blue-950">
                        ATTENDANCE {stat.branchName.toUpperCase()} BRANCH
                      </h3>
                      <ExternalLink className="h-4 w-4 text-blue-700 group-hover:text-blue-900" />
                    </Link>
                  </div>
                  <div className="flex items-center gap-4 text-blue-700 font-semibold">
                    <span>Total: {stat.totalEmployees}</span>
                    <span>Present: {stat.present}</span>
                    <span>Absent: {stat.absent}</span>
                    <span>Pending: {stat.pending}</span>
                    <span>Not Added: {stat.notAdded}</span>
                  </div>
                </div>
              </div>

              {/* Employee Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-16">S.NO.</TableHead>
                      <TableHead>EMPLOYEE NAME</TableHead>
                      <TableHead>DESIGNATION</TableHead>
                      <TableHead>TIMING</TableHead>
                      <TableHead>ATTENDANCE</TableHead>
                      <TableHead>OVERTIME/NOTES</TableHead>
                      {userRole === "HR" && (
                        <TableHead className="w-32">ACTIONS</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stat.employees.map((employee, index) => {
                      const timing = formatTiming(employee);
                      const notes = getNotes(employee);
                      const isAbsent = !employee.attendance[0] || !employee.attendance[0].isPresent;
                      
                      return (
                        <TableRow 
                          key={employee.id}
                          className={cn(
                            isAbsent && "bg-red-50/50"
                          )}
                        >
                          <TableCell className="font-medium">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            {employee.name?.toUpperCase() || "N/A"}
                          </TableCell>
                          <TableCell>
                            {employee.department?.name ? employee.department.name.toUpperCase() : "N/A"}
                          </TableCell>
                          <TableCell>
                            <span className="text-foreground">
                              {timing}
                            </span>
                          </TableCell>
                          <TableCell>
                            {getStatusDisplay(employee)}
                          </TableCell>
                          <TableCell>
                            {notes ? (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
                                {notes}
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          {userRole === "HR" && (
                            <TableCell>
                              {employee.attendance[0]?.status === "PENDING_VERIFICATION" && (
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2 text-green-600 hover:bg-green-50 hover:text-green-700"
                                    onClick={() =>
                                      handleVerifyAttendance(
                                        employee.attendance[0].id,
                                        "APPROVED"
                                      )
                                    }
                                    disabled={processingIds.has(employee.attendance[0].id)}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={() =>
                                      handleVerifyAttendance(
                                        employee.attendance[0].id,
                                        "REJECTED"
                                      )
                                    }
                                    disabled={processingIds.has(employee.attendance[0].id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

            </div>
          );
        })}
      </div>

      {branchStats.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No branches found
        </div>
      )}
    </div>
  );
}

