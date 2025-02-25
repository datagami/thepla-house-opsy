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
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AttendanceStatusFilter } from "./attendance-status-filter";
import { Loader2 } from "lucide-react";

interface AttendanceRecord {
  id: string;
  date: Date;
  isPresent: boolean;
  isHalfDay: boolean;
  overtime: boolean;
  checkIn: string | null;
  checkOut: string | null;
  shift1: boolean;
  shift2: boolean;
  shift3: boolean;
  status: string;
  user: {
    name: string | null;
    branch: {
      name: string | null;
    } | null;
  };
}

interface AttendanceVerificationTableProps {
  records: AttendanceRecord[];
  currentStatus: string;
}

export function AttendanceVerificationTable({ 
  records, 
  currentStatus 
}: AttendanceVerificationTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleStatusChange = (status: string) => {
    setIsLoading('filter');
    const params = new URLSearchParams(searchParams.toString());
    if (status === "PENDING") {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    
    // Force a server refresh
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

      toast.success(`Attendance ${status.toLowerCase()} successfully`);
      
      // Force a full page refresh to update stats
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to verify attendance");
    } finally {
      setIsLoading(null);
    }
  };

  const getAttendanceStatus = (record: AttendanceRecord) => {
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
      <div className="p-4 flex justify-between items-center">
        <AttendanceStatusFilter 
          value={currentStatus}
          onChange={handleStatusChange}
        />
        <div className="text-sm text-muted-foreground">
          Showing attendance for {format(new Date(), "PPP")}
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
                  {record.isPresent ? [
                    record.shift1 && "Morning",
                    record.shift2 && "Afternoon",
                    record.shift3 && "Night",
                  ].filter(Boolean).join(", ") : "-"}
                </TableCell>
                <TableCell>{getVerificationStatus(record.status)}</TableCell>
                <TableCell className="text-right space-x-2">
                  {record.status === "PENDING" && (
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