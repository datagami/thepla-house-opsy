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
import { useRouter } from "next/navigation";
import { AttendanceForm } from "./attendance-form";
import {Attendance} from "@/models/models";


interface BranchAttendanceTableProps {
  records: Attendance[];
}

export function BranchAttendanceTable({ records }: BranchAttendanceTableProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);

  const handleResubmit = async (recordId: string, attendanceData: Attendance) => {
    setIsLoading(recordId);
    try {
      const response = await fetch(`/api/attendance/${recordId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...attendanceData,
          status: "PENDING", // Reset status to pending
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to resubmit attendance");
      }

      toast.success("Attendance resubmitted successfully");
      router.refresh();
      setSelectedRecord(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resubmit attendance");
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

  const rejectedRecords = records.filter(record => record.status === "REJECTED");

  if (rejectedRecords.length === 0) {
    return <div className="text-center p-4">No rejected attendance records to handle</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rejection Note</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rejectedRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell>{format(new Date(record.date), "PPP")}</TableCell>
                <TableCell>{record.user.name}</TableCell>
                <TableCell>{getAttendanceStatus(record)}</TableCell>
                <TableCell>{record.verificationNote || "-"}</TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedRecord(record)}
                    disabled={!!isLoading}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-800"
                  >
                    Edit & Resubmit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AttendanceForm
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onSubmit={(data: Attendance) => selectedRecord && handleResubmit(selectedRecord.id, data)}
        defaultValues={selectedRecord || undefined}
        isLoading={!!isLoading}
      />
    </div>
  );
} 
