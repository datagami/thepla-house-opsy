"use client";

import React from "react";
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
            
            return attendance.notes || null;
          };

          const getBadges = (employee: EmployeeAttendance) => {
            const attendance = employee.attendance[0];
            if (!attendance) return [];
            
            const badges = [];
            if (attendance.isHalfDay) badges.push({ label: "Half Day", className: "bg-orange-50 text-orange-800 border-orange-200" });
            if (attendance.overtime) badges.push({ label: "OT", className: "bg-yellow-50 text-yellow-800 border-yellow-200" });
            
            return badges;
          };

          const getStatusDisplay = (employee: EmployeeAttendance) => {
            const attendance = employee.attendance[0];
            if (!attendance) {
              return (
                <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300 font-semibold text-[10px] md:text-sm">
                  NOT ADDED
                </Badge>
              );
            }
            if (!attendance.isPresent) {
              return (
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 font-semibold text-[10px] md:text-sm">
                  ABSENT
                </Badge>
              );
            }
            return (
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 font-semibold text-[10px] md:text-sm">
                PRESENT
              </Badge>
            );
          };

          // Fixed color mapping for specific designations
          const getDesignationColor = (designation: string) => {
            const colorMap: Record<string, { headerBg: string; headerText: string; cardBg: string }> = {
              'cook': { headerBg: 'bg-blue-200', headerText: 'text-blue-900', cardBg: 'bg-blue-50' },
              'semi cook': { headerBg: 'bg-purple-200', headerText: 'text-purple-900', cardBg: 'bg-purple-50' },
              'roti': { headerBg: 'bg-indigo-200', headerText: 'text-indigo-900', cardBg: 'bg-indigo-50' },
              'kot': { headerBg: 'bg-pink-200', headerText: 'text-pink-900', cardBg: 'bg-pink-50' },
              'helper': { headerBg: 'bg-cyan-200', headerText: 'text-cyan-900', cardBg: 'bg-cyan-50' },
              'utility': { headerBg: 'bg-amber-200', headerText: 'text-amber-900', cardBg: 'bg-amber-50' },
            };

            // Default colors for other designations
            const defaultColors = [
              { headerBg: 'bg-emerald-200', headerText: 'text-emerald-900', cardBg: 'bg-emerald-50' },
              { headerBg: 'bg-orange-200', headerText: 'text-orange-900', cardBg: 'bg-orange-50' },
              { headerBg: 'bg-teal-200', headerText: 'text-teal-900', cardBg: 'bg-teal-50' },
              { headerBg: 'bg-rose-200', headerText: 'text-rose-900', cardBg: 'bg-rose-50' },
              { headerBg: 'bg-lime-200', headerText: 'text-lime-900', cardBg: 'bg-lime-50' },
              { headerBg: 'bg-violet-200', headerText: 'text-violet-900', cardBg: 'bg-violet-50' },
            ];

            const normalizedDesignation = designation.toLowerCase().trim();
            if (colorMap[normalizedDesignation]) {
              return colorMap[normalizedDesignation];
            }

            // For other designations, use a hash-based approach for consistent colors
            let hash = 0;
            for (let i = 0; i < normalizedDesignation.length; i++) {
              hash = normalizedDesignation.charCodeAt(i) + ((hash << 5) - hash);
            }
            return defaultColors[Math.abs(hash) % defaultColors.length];
          };

          // Priority order for important designations
          const priorityOrder = ['cook', 'semi cook', 'roti', 'kot', 'helper', 'utility'];
          
          // Custom sort function
          const sortDesignations = (a: { designation: string }, b: { designation: string }) => {
            const aLower = a.designation.toLowerCase().trim();
            const bLower = b.designation.toLowerCase().trim();
            
            const aIndex = priorityOrder.findIndex(p => p === aLower);
            const bIndex = priorityOrder.findIndex(p => p === bLower);
            
            // If both are in priority list, sort by priority order
            if (aIndex !== -1 && bIndex !== -1) {
              return aIndex - bIndex;
            }
            
            // If only one is in priority list, prioritize it
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            
            // If neither is in priority list, sort alphabetically
            return a.designation.localeCompare(b.designation);
          };

          // Group employees by designation
          const groupedByDesignation = stat.employees.reduce((acc, employee) => {
            const designation = employee.department?.name || "N/A";
            if (!acc[designation]) {
              acc[designation] = [];
            }
            acc[designation].push(employee);
            return acc;
          }, {} as Record<string, EmployeeAttendance[]>);

          // Convert to array and sort by priority order, then alphabetically
          const designationGroups = Object.entries(groupedByDesignation)
            .map(([designation, employees]) => ({
              designation,
              employees,
            }))
            .sort(sortDesignations);

          return (
            <div key={stat.branchId} className="rounded-md border bg-card">
              {/* Branch Header - Sticky on mobile */}
              <div className="sticky top-0 z-20 bg-blue-50 border-b px-4 sm:px-6 py-3 md:py-4">
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
                      <TableHead className="w-[150px]">DESIGNATION</TableHead>
                      <TableHead className="w-16">S.NO.</TableHead>
                      <TableHead>EMPLOYEE NAME</TableHead>
                      <TableHead>TIMING</TableHead>
                      <TableHead>ATTENDANCE</TableHead>
                      <TableHead className="min-w-[120px]">OVERTIME/NOTES</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      let serialNumber = 0;
                      return designationGroups.map((group) => {
                        const designationColor = getDesignationColor(group.designation);
                        return group.employees.map((employee, employeeIndex) => {
                          const timing = formatTiming(employee);
                          const notes = getNotes(employee);
                          const badges = getBadges(employee);
                          const isFirstInGroup = employeeIndex === 0;
                          const rowSpan = group.employees.length;
                          serialNumber++;
                          
                          return (
                            <TableRow 
                              key={employee.id}
                            >
                              {isFirstInGroup && (
                                <TableCell 
                                  rowSpan={rowSpan}
                                  className={cn(
                                    "font-semibold align-top border-r",
                                    designationColor.headerBg,
                                    designationColor.headerText
                                  )}
                                >
                                  {group.designation.toUpperCase()}
                                </TableCell>
                              )}
                              <TableCell className="font-medium">
                                {serialNumber}
                              </TableCell>
                            <TableCell className="font-medium">
                              {employee.name?.toUpperCase() || "N/A"}
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
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {badges.map((badge, idx) => (
                                  <Badge key={idx} variant="outline" className={badge.className}>
                                    {badge.label}
                                  </Badge>
                                ))}
                                {notes && (
                                  <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
                                    {notes}
                                  </Badge>
                                )}
                                {badges.length === 0 && !notes && "-"}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      });
                    });
                    })()}
                  </TableBody>
                </Table>
              </div>

              {/* Employee Cards - Mobile/Tablet */}
              <div className="md:hidden space-y-3">
                {(() => {
                  let serialNumber = 0;
                  return designationGroups.map((group) => {
                    const designationColor = getDesignationColor(group.designation);
                    return (
                      <Card key={group.designation} className={cn("overflow-hidden", designationColor.cardBg)}>
                        {/* Designation Header */}
                        <div className={cn("px-3 py-2.5 border-b", designationColor.headerBg)}>
                          <h4 className={cn("font-semibold text-xs", designationColor.headerText)}>
                            {group.designation.toUpperCase()}
                          </h4>
                        </div>
                        {/* Employees in this designation */}
                        <div className="divide-y">
                          {group.employees.map((employee) => {
                            const timing = formatTiming(employee);
                            const notes = getNotes(employee);
                            const badges = getBadges(employee);
                            serialNumber++;
                            
                            return (
                              <div
                                key={employee.id}
                                className="px-3 py-2.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[10px] font-medium text-muted-foreground">
                                        {serialNumber}.
                                      </span>
                                      <h4 className="font-semibold text-xs break-words">
                                        {employee.name?.toUpperCase() || "N/A"}
                                      </h4>
                                      <span className="text-[10px] text-muted-foreground">•</span>
                                      <span className="text-[10px] text-foreground">{timing}</span>
                                      {badges.map((badge, idx) => (
                                        <span key={idx} className="flex items-center gap-1.5">
                                          <span className="text-[10px] text-muted-foreground">•</span>
                                          <Badge variant="outline" className={`${badge.className} text-[9px] px-1 py-0 h-3.5 leading-tight`}>
                                            {badge.label}
                                          </Badge>
                                        </span>
                                      ))}
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
                      </Card>
                    );
                  });
                })()}
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

