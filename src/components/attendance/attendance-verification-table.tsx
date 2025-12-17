"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { usePathname, useSearchParams } from "next/navigation";
import { AttendanceStatusFilter } from "./attendance-status-filter";
import { Loader2 } from "lucide-react";
import { AttendanceDateFilter } from "./attendance-date-filter";
import { AttendanceBranchFilter } from "./attendance-branch-filter";
import { Attendance } from "@/models/models";
import { AttendanceForm } from "./attendance-form";
import { getShiftDisplay } from "@/lib/utils/shift-display";


interface AttendanceVerificationTableProps {
  records: Attendance[];
  currentStatus: string;
  currentDate: Date;
  currentBranch: string;
  branches: string[];
}

export function AttendanceVerificationTable({ 
  records, 
  currentStatus,
  currentDate,
  currentBranch,
  branches,
}: AttendanceVerificationTableProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);

  const handleStatusChange = (status: string) => {
    setIsLoading('filter');
    const params = new URLSearchParams(searchParams.toString());
    if (status === "PENDING") {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    window.location.href = `${pathname}?${params.toString()}`;
  };

  const handleDateChange = (date: Date) => {
    setIsLoading('filter');
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", format(date, "yyyy-MM-dd"));
    window.location.href = `${pathname}?${params.toString()}`;
  };

  const handleBranchChange = (branch: string) => {
    setIsLoading('filter');
    const params = new URLSearchParams(searchParams.toString());
    params.set("branch", branch);
    window.location.href = `${pathname}?${params.toString()}`;
  };


  const getAttendanceStatus = (record: Attendance) => {
    if (record.isHalfDay) return <Badge className="bg-blue-100 text-blue-800">Half Day</Badge>;
    if (record.overtime) return <Badge className="bg-purple-100 text-purple-800">Overtime</Badge>;
    return record.isPresent ? 
      <Badge className="bg-green-100 text-green-800">Present</Badge> : 
      <Badge className="bg-red-100 text-red-800">Absent</Badge>;
  };

  const getVerificationStatus = (status: string) => {
    const statusColors = {
      PENDING: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-emerald-100 text-emerald-800",
      REJECTED: "bg-red-100 text-red-800",
    };
    return (
      <Badge className={statusColors[status as keyof typeof statusColors]}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <AttendanceStatusFilter 
            value={currentStatus}
            onChange={handleStatusChange}
          />
          <AttendanceBranchFilter
            value={currentBranch}
            onChange={handleBranchChange}
            branches={branches}
          />
          <AttendanceDateFilter 
            date={currentDate}
            onChange={handleDateChange}
          />
        </div>
      </div>
      {isLoading === 'filter' ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Attendance Status</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Shifts</TableHead>
              <TableHead>Verification Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow 
                key={record.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelectedRecord(record)}
              >
                <TableCell>{format(new Date(record.date), "PPP")}</TableCell>
                <TableCell>{record.user.name}</TableCell>
                <TableCell>{record.user.branch?.name || "-"}</TableCell>
                <TableCell>{record.user.department?.name || "-"}</TableCell>
                <TableCell>{getAttendanceStatus(record)}</TableCell>
                <TableCell>
                  {record.isPresent && record.checkIn && record.checkOut ? 
                    `${record.checkIn} - ${record.checkOut}` : 
                    "-"
                  }
                </TableCell>
                <TableCell>
                  {record.isPresent ? getShiftDisplay(record.shift1, record.shift2, record.shift3) : "-"}
                </TableCell>
                <TableCell>{getVerificationStatus(record.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {selectedRecord && (
        <AttendanceForm
          userId={selectedRecord.userId}
          userName={selectedRecord.user.name}
          date={new Date(selectedRecord.date)}
          currentAttendance={selectedRecord}
          isOpen={!!selectedRecord}
          department={selectedRecord.user.department?.name || ''}
          onCloseAction={() => setSelectedRecord(null)}
          isHR={true}
          userRole="HR"
        />
      )}
    </div>
  );
} 
