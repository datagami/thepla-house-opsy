"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AttendanceEditDialog } from "@/components/attendance/attendance-edit-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {User} from "@/models/models";


interface PendingRecord {
  id: string;
  date: Date;
  isPresent: boolean;
  checkIn: Date | null;
  checkOut: Date | null;
  isHalfDay: boolean;
  overtime: boolean;
  shift1: boolean;
  shift2: boolean;
  shift3: boolean;
  status: string;
  user: {
    name: string;
    branch: { name: string } | null;
  };
}

interface HRAttendanceTableProps {
  managers?: User[];
  pendingRecords?: PendingRecord[];
}

export function HRAttendanceTable({ managers, pendingRecords }: HRAttendanceTableProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const handleApproval = async (recordId: string, status: "APPROVED" | "REJECTED") => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/attendance/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attendanceId: recordId,
          status,
          note,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update attendance");
      }

      toast.success(`Attendance ${status.toLowerCase()} successfully`);
      router.refresh();
      setSelectedRecord(null);
      setNote("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update attendance");
    } finally {
      setIsLoading(false);
    }
  };

  if (managers) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Check In</TableHead>
            <TableHead>Check Out</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {managers.map((manager) => {
            const attendance = manager.attendance[0];
            return (
              <TableRow key={manager.id}>
                <TableCell>{manager.name}</TableCell>
                <TableCell>{manager.managedBranch?.name}</TableCell>
                <TableCell>
                  {attendance ? (
                    <Badge variant={attendance.isPresent ? "default" : "destructive"}>
                      {attendance.isPresent ? "Present" : "Absent"}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Not Marked</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {attendance?.checkIn ? format(new Date(attendance.checkIn), "hh:mm a") : "-"}
                </TableCell>
                <TableCell>
                  {attendance?.checkOut ? format(new Date(attendance.checkOut), "hh:mm a") : "-"}
                </TableCell>
                <TableCell className="text-right">
                  <AttendanceEditDialog 
                    attendance={attendance} 
                    userId={manager.id}
                    date={new Date()}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  if (pendingRecords) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Check In</TableHead>
            <TableHead>Check Out</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pendingRecords.map((record) => (
            <TableRow key={record.id}>
              <TableCell>{format(new Date(record.date), "dd MMM yyyy")}</TableCell>
              <TableCell>{record.user.name}</TableCell>
              <TableCell>{record.user.branch?.name}</TableCell>
              <TableCell>
                <Badge variant={record.isPresent ? "success" : "destructive"}>
                  {record.isPresent ? "Present" : "Absent"}
                </Badge>
              </TableCell>
              <TableCell>
                {record.checkIn ? format(new Date(record.checkIn), "hh:mm a") : "-"}
              </TableCell>
              <TableCell>
                {record.checkOut ? format(new Date(record.checkOut), "hh:mm a") : "-"}
              </TableCell>
              <TableCell className="text-right">
                <Dialog open={selectedRecord === record.id} onOpenChange={(open) => {
                  if (!open) {
                    setSelectedRecord(null);
                    setNote("");
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedRecord(record.id)}
                    >
                      Verify
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Verify Attendance</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Textarea
                          placeholder="Add a note (optional)"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="destructive"
                          onClick={() => handleApproval(record.id, "REJECTED")}
                          disabled={isLoading}
                        >
                          Reject
                        </Button>
                        <Button
                          onClick={() => handleApproval(record.id, "APPROVED")}
                          disabled={isLoading}
                        >
                          Approve
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return null;
} 
