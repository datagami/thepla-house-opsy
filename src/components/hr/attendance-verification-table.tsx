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

interface AttendanceVerificationTableProps {
  data: Array<{
    id: string;
    date: Date;
    checkIn: Date | null;
    checkOut: Date | null;
    isHalfDay: boolean;
    overtime: boolean;
    shift1: boolean;
    shift2: boolean;
    shift3: boolean;
    user: {
      name: string;
      branch: {
        name: string;
      } | null;
    };
  }>;
}

export function AttendanceVerificationTable({ data }: AttendanceVerificationTableProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const handleVerification = async (id: string, status: "APPROVED" | "REJECTED") => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/attendance/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attendanceId: id,
          status,
          note,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to verify attendance");
      }

      toast.success(`Attendance ${status.toLowerCase()} successfully`);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to verify attendance");
    } finally {
      setIsLoading(false);
      setSelectedId(null);
      setNote("");
    }
  };

  const getShifts = (attendance: typeof data[0]) => {
    const shifts = [];
    if (attendance.shift1) shifts.push("1");
    if (attendance.shift2) shifts.push("2");
    if (attendance.shift3) shifts.push("3");
    return shifts.length ? `Shift ${shifts.join(", ")}` : "-";
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Check In</TableHead>
            <TableHead>Check Out</TableHead>
            <TableHead>Shifts</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((attendance) => (
            <TableRow key={attendance.id}>
              <TableCell>{format(attendance.date, "PP")}</TableCell>
              <TableCell>{attendance.user.name}</TableCell>
              <TableCell>{attendance.user.branch?.name || "-"}</TableCell>
              <TableCell>
                {attendance.checkIn ? format(attendance.checkIn, "pp") : "-"}
              </TableCell>
              <TableCell>
                {attendance.checkOut ? format(attendance.checkOut, "pp") : "-"}
              </TableCell>
              <TableCell>{getShifts(attendance)}</TableCell>
              <TableCell>
                <Badge variant={attendance.isHalfDay ? "destructive" : "default"}>
                  {attendance.isHalfDay ? "Half Day" : "Full Day"}
                </Badge>
                {attendance.overtime && (
                  <Badge variant="outline" className="ml-2">
                    Overtime
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <Dialog open={selectedId === attendance.id} onOpenChange={(open) => !open && setSelectedId(null)}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedId(attendance.id)}
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
                        <label className="text-sm font-medium">Verification Note</label>
                        <Textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Add any notes about this verification..."
                          className="mt-1"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleVerification(attendance.id, "REJECTED")}
                          disabled={isLoading}
                        >
                          Reject
                        </Button>
                        <Button
                          onClick={() => handleVerification(attendance.id, "APPROVED")}
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
    </div>
  );
} 
