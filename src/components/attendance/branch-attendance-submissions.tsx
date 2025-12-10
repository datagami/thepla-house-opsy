"use client";

import { format } from "date-fns";
import { Calendar as CalendarIcon, ExternalLink } from "lucide-react";
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
import { Card, CardTitle } from "@/components/ui/card";
import { getShiftDisplay } from "@/lib/utils/shift-display";

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
}

export function BranchAttendanceSubmissions({
  branchStats,
  selectedDate,
}: BranchAttendanceSubmissionsProps) {
  const router = useRouter();

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      router.push(
        `/hr/branch-attendance?date=${format(date, "yyyy-MM-dd")}`
      );
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
    <div className="space-y-2 md:space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-1.5 md:gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <div className="p-2 md:p-6">
            <div className="flex items-center justify-between md:flex-col md:items-start md:space-y-1.5">
              <CardTitle className="text-[9px] md:text-sm font-medium leading-tight">Total Branches</CardTitle>
              <div className="text-base md:text-2xl font-bold">{totalBranches}</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-2 md:p-6">
            <div className="flex items-center justify-between md:flex-col md:items-start md:space-y-1.5">
              <CardTitle className="text-[9px] md:text-sm font-medium leading-tight">Total Employees</CardTitle>
              <div className="text-base md:text-2xl font-bold">{totalEmployees}</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-2 md:p-6">
            <div className="flex items-center justify-between md:flex-col md:items-start md:space-y-1.5">
              <div className="flex flex-col min-w-0">
                <CardTitle className="text-[9px] md:text-sm font-medium leading-tight">Submissions</CardTitle>
                <p className="text-[8px] md:text-xs text-muted-foreground mt-0.5 md:mt-0">
                  {overallCompletion}%
                </p>
              </div>
              <div className="text-base md:text-2xl font-bold">{totalSubmitted}</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-2 md:p-6">
            <div className="flex items-center justify-between md:flex-col md:items-start md:space-y-1.5">
              <CardTitle className="text-[9px] md:text-sm font-medium leading-tight">Pending</CardTitle>
              <div className="text-base md:text-2xl font-bold text-yellow-600">
                {totalPending}
              </div>
            </div>
          </div>
        </Card>

        <Card className="col-span-2 md:col-span-1">
          <div className="p-2 md:p-6">
            <div className="flex items-center justify-between md:flex-col md:items-start md:space-y-1.5">
              <CardTitle className="text-[9px] md:text-sm font-medium leading-tight">Approved</CardTitle>
              <div className="text-base md:text-2xl font-bold text-green-600">
                {totalApproved}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Date Picker */}
      <div className="flex items-center gap-2 md:gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[240px] justify-start text-left font-normal h-8 md:h-10 text-xs md:text-sm",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-3 w-3 md:h-4 md:w-4" />
              <span className="truncate">{format(selectedDate, "PPP")}</span>
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
      <div className="space-y-3 md:space-y-6">
        {branchStats.map((stat) => {
          const formatTiming = (employee: EmployeeAttendance) => {
            const attendance = employee.attendance[0];
            if (!attendance || !attendance.isPresent) {
              return "-";
            }
            
            return getShiftDisplay(attendance.shift1, attendance.shift2, attendance.shift3);
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
                <span className="text-muted-foreground font-semibold text-[10px] md:text-sm">NOT ADDED</span>
              );
            }
            if (!attendance.isPresent) {
              return (
                <span className="text-red-600 font-semibold text-[10px] md:text-sm">ABSENT</span>
              );
            }
            return (
              <span className="text-green-600 font-semibold text-[10px] md:text-sm">PRESENT</span>
            );
          };

          return (
            <div key={stat.branchId} className="rounded-md border bg-card">
              {/* Branch Header - Sticky on mobile */}
              <div className="sticky top-0 z-10 bg-blue-50 border-b px-4 sm:px-6 py-3 md:py-4">
                <div className="flex flex-col gap-2 md:gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <Link
                      href={`/hr/attendance-verification?date=${format(selectedDate, "yyyy-MM-dd")}&branch=${stat.branchName}`}
                      className="group flex items-center gap-2 hover:underline"
                    >
                      <h3 className="text-sm sm:text-base md:text-lg font-bold text-blue-900 group-hover:text-blue-950 break-words">
                        ATTENDANCE {stat.branchName.toUpperCase()} BRANCH
                      </h3>
                      <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 text-blue-700 group-hover:text-blue-900 flex-shrink-0" />
                    </Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 md:gap-4 text-xs sm:text-sm md:text-base text-blue-700 font-semibold">
                    <span className="whitespace-nowrap">Total: {stat.totalEmployees}</span>
                    <span className="whitespace-nowrap">Present: {stat.present}</span>
                    <span className="whitespace-nowrap">Absent: {stat.absent}</span>
                    <span className="whitespace-nowrap">Pending: {stat.pending}</span>
                    <span className="whitespace-nowrap">Not Added: {stat.notAdded}</span>
                  </div>
                </div>
              </div>

              {/* Employee Table - Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-16">S.NO.</TableHead>
                      <TableHead>EMPLOYEE NAME</TableHead>
                      <TableHead>DESIGNATION</TableHead>
                      <TableHead>TIMING</TableHead>
                      <TableHead>ATTENDANCE</TableHead>
                      <TableHead className="min-w-[120px]">OVERTIME/NOTES</TableHead>
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
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Employee Cards - Mobile */}
              <div className="md:hidden divide-y">
                {stat.employees.map((employee, index) => {
                  const timing = formatTiming(employee);
                  const notes = getNotes(employee);
                  const isAbsent = !employee.attendance[0] || !employee.attendance[0].isPresent;
                  
                  return (
                    <div
                      key={employee.id}
                      className={cn(
                        "px-3 py-2",
                        isAbsent && "bg-red-50/50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-medium text-muted-foreground">
                              {index + 1}.
                            </span>
                            <h4 className="font-semibold text-xs break-words">
                              {employee.name?.toUpperCase() || "N/A"}
                            </h4>
                            <span className="text-[10px] text-muted-foreground">
                              {employee.department?.name ? employee.department.name.toUpperCase() : "N/A"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">•</span>
                            <span className="text-[10px] text-foreground">{timing}</span>
                            {notes && (
                              <>
                                <span className="text-[10px] text-muted-foreground">•</span>
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200 text-[9px] px-1 py-0 h-3.5 leading-tight">
                                  {notes}
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          {getStatusDisplay(employee)}
                        </div>
                      </div>
                    </div>
                  );
                })}
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

