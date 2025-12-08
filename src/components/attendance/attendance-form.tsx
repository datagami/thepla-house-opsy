"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AttendanceFormProps, AttendanceFormData } from "@/models/attendance";

export function AttendanceForm({
  userId,
  userName,
  date,
  currentAttendance,
  isOpen,
  onCloseAction,
  userRole,
  department
}: AttendanceFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isPresent, setIsPresent] = useState(currentAttendance?.isPresent ?? true);
  const [isHalfDay, setIsHalfDay] = useState(currentAttendance?.isHalfDay ?? false);
  const [isOvertime, setIsOvertime] = useState(currentAttendance?.overtime ?? false);
  const [shift1, setShift1] = useState(currentAttendance?.shift1 ?? false);
  const [shift2, setShift2] = useState(currentAttendance?.shift2 ?? false);
  const [shift3, setShift3] = useState(currentAttendance?.shift3 ?? false);
  const [checkIn, setCheckIn] = useState(currentAttendance?.checkIn || "");
  const [checkOut, setCheckOut] = useState(currentAttendance?.checkOut || "");
  const [notes, setNotes] = useState(currentAttendance?.notes || "");

  // Update form fields when currentAttendance changes
  useEffect(() => {
    if (currentAttendance) {
      setIsPresent(currentAttendance.isPresent ?? true);
      setIsHalfDay(currentAttendance.isHalfDay ?? false);
      setIsOvertime(currentAttendance.overtime ?? false);
      setShift1(currentAttendance.shift1 ?? false);
      setShift2(currentAttendance.shift2 ?? false);
      setShift3(currentAttendance.shift3 ?? false);
      setCheckIn(currentAttendance.checkIn || "");
      setCheckOut(currentAttendance.checkOut || "");
      setNotes(currentAttendance.notes || "");
    }
  }, [currentAttendance]);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const attendanceDate = new Date(date || new Date());
      attendanceDate.setHours(0, 0, 0, 0);

      const attendanceData: AttendanceFormData = {
        userId: userId || null,
        date: attendanceDate,
        isPresent,
        checkIn: checkIn || null,
        checkOut: checkOut || null,
        isHalfDay: isPresent && isHalfDay,
        overtime: isPresent && isOvertime,
        shift1: isPresent && shift1,
        shift2: isPresent && shift2,
        shift3: isPresent && shift3,
        notes: notes || null,
        status: userRole === "HR" || "MANAGEMENT" ? "APPROVED" : "PENDING_VERIFICATION",
        ...(currentAttendance?.id && userRole !== "HR" && {
          verificationNote: currentAttendance.verificationNote,
          verifiedById: currentAttendance.verifiedById,
          verifiedAt: currentAttendance.verifiedAt
        })
      };

      const response = await fetch(
        currentAttendance?.id 
          ? `/api/attendance/${currentAttendance.id}` 
          : "/api/attendance", 
        {
          method: currentAttendance?.id ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(attendanceData),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to mark attendance");
      }

      toast.success(
        currentAttendance?.id
          ? "Attendance updated successfully"
          : "Attendance marked successfully"
      );
      onCloseAction();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to mark attendance");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePresentChange = (checked: boolean) => {
    setIsPresent(checked);
    if (!checked) {
      setIsHalfDay(false);
      setIsOvertime(false);
      setShift1(false);
      setShift2(false);
      setShift3(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCloseAction}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark Attendance for {userName} ({department})</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="isPresent">Present</Label>
            <Switch 
              id="isPresent" 
              checked={isPresent}
              onCheckedChange={handlePresentChange}
            />
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="checkIn">Check In Time</Label>
              <Input
                id="checkIn"
                type="time"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                disabled={!isPresent}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="checkOut">Check Out Time</Label>
              <Input
                id="checkOut"
                type="time"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                disabled={!isPresent}
                className="mt-1"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="shift1">7 AM to 11 AM</Label>
              <Switch 
                id="shift1"
                checked={shift1}
                onCheckedChange={setShift1}
                disabled={!isPresent}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="shift2">11 AM to 7 PM</Label>
              <Switch 
                id="shift2"
                checked={shift2}
                onCheckedChange={setShift2}
                disabled={!isPresent}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="shift3">7 PM to 11 PM</Label>
              <Switch 
                id="shift3"
                checked={shift3}
                onCheckedChange={setShift3}
                disabled={!isPresent}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="isHalfDay">Half Day</Label>
              <Switch 
                id="isHalfDay" 
                checked={isHalfDay}
                onCheckedChange={setIsHalfDay}
                disabled={!isPresent || isOvertime}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="overtime">Overtime</Label>
              <Switch 
                id="overtime" 
                checked={isOvertime}
                onCheckedChange={setIsOvertime}
                disabled={!isPresent || isHalfDay}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              className="mt-1"
              rows={3}
            />
          </div>

          <Button 
            onClick={handleSubmit} 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Save Attendance"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
