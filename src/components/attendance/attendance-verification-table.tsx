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
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import { usePathname, useSearchParams } from "next/navigation";
import { AttendanceStatusFilter } from "./attendance-status-filter";
import { Loader2 } from "lucide-react";
import { AttendanceDateFilter } from "./attendance-date-filter";
import { AttendanceBranchFilter } from "./attendance-branch-filter";
import { Attendance } from "@/models/models";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

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

  const handleVerification = async (recordId: string, status: "APPROVED" | "REJECTED") => {
    setIsLoading(recordId);
    try {
      const response = await fetch(`/api/attendance/${recordId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          status,
          verificationNote: status === "APPROVED" ? "Approved by HR" : "Rejected by HR"
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to verify attendance");
      }

      router.refresh();
      toast.success(`Attendance ${status.toLowerCase()} successfully`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to verify attendance");
    } finally {
      setIsLoading(null);
    }
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
              <TableHead>Attendance Status</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Shifts</TableHead>
              <TableHead>Verification Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id}>
                <TableCell>{format(new Date(record.date), "PPP")}</TableCell>
                <TableCell>{record.user.name}</TableCell>
                <TableCell>{record.user.branch?.name || "-"}</TableCell>
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
                <TableCell className="text-right space-x-2">
                  {record.status === "PENDING_VERIFICATION" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerification(record.id, "APPROVED")}
                        disabled={!!isLoading}
                        className="bg-green-100 hover:bg-green-200 text-green-800"
                      >
                        {isLoading === record.id ? "Processing..." : "Approve"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerification(record.id, "REJECTED")}
                        disabled={!!isLoading}
                        className="bg-red-100 hover:bg-red-200 text-red-800"
                      >
                        {isLoading === record.id ? "Processing..." : "Reject"}
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
} 
