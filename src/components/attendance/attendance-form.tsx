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
  department,
  isHR = false
}: AttendanceFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isPresent, setIsPresent] = useState(currentAttendance?.isPresent ?? true);
  const [isHalfDay, setIsHalfDay] = useState(currentAttendance?.isHalfDay ?? false);
  const [isOvertime, setIsOvertime] = useState(currentAttendance?.overtime ?? false);
  const [isWeeklyOff, setIsWeeklyOff] = useState(currentAttendance?.isWeeklyOff ?? false);
  const [isWorkFromHome, setIsWorkFromHome] = useState(currentAttendance?.isWorkFromHome ?? false);
  const [shift1, setShift1] = useState(currentAttendance?.shift1 ?? false);
  const [shift2, setShift2] = useState(currentAttendance?.shift2 ?? false);
  const [shift3, setShift3] = useState(currentAttendance?.shift3 ?? false);
  const [checkIn, setCheckIn] = useState(currentAttendance?.checkIn || "");
  const [checkOut, setCheckOut] = useState(currentAttendance?.checkOut || "");
  const [notes, setNotes] = useState(currentAttendance?.notes || "");
  const [verificationNote, setVerificationNote] = useState(currentAttendance?.verificationNote || "");
  const [userWeeklyOffConfig, setUserWeeklyOffConfig] = useState<{
    hasWeeklyOff: boolean;
    weeklyOffType: string | null;
    weeklyOffDay: number | null;
    hasWorkFromHome: boolean;
  } | null>(null);
  
  const isPendingVerification = currentAttendance?.status === "PENDING_VERIFICATION";
  const showApproveReject = isHR && isPendingVerification && currentAttendance?.id;

  // Fetch user's weekly off configuration
  useEffect(() => {
    if (userId) {
      fetch(`/api/users/${userId}`)
        .then(res => res.json())
        .then(user => {
          if (user) {
            setUserWeeklyOffConfig({
              hasWeeklyOff: user.hasWeeklyOff || false,
              weeklyOffType: user.weeklyOffType || null,
              weeklyOffDay: user.weeklyOffDay || null,
              hasWorkFromHome: user.hasWorkFromHome || false,
            });
            
            // For fixed weekly off, check if selected date matches weekly off day
            if (user.hasWeeklyOff && user.weeklyOffType === "FIXED" && date) {
              const dayOfWeek = new Date(date).getDay();
              if (user.weeklyOffDay === dayOfWeek) {
                setIsWeeklyOff(true);
                setIsPresent(true);
              }
            }
          }
        })
        .catch(() => {
          // Ignore errors
        });
    }
  }, [userId, date]);

  // Update form fields when currentAttendance changes
  useEffect(() => {
    if (currentAttendance) {
      setIsPresent(currentAttendance.isPresent ?? true);
      setIsHalfDay(currentAttendance.isHalfDay ?? false);
      setIsOvertime(currentAttendance.overtime ?? false);
      setIsWeeklyOff(currentAttendance.isWeeklyOff ?? false);
      setIsWorkFromHome((currentAttendance as { isWorkFromHome?: boolean }).isWorkFromHome ?? false);
      setShift1(currentAttendance.shift1 ?? false);
      setShift2(currentAttendance.shift2 ?? false);
      setShift3(currentAttendance.shift3 ?? false);
      setCheckIn(currentAttendance.checkIn || "");
      setCheckOut(currentAttendance.checkOut || "");
      setNotes(currentAttendance.notes || "");
      setVerificationNote(currentAttendance.verificationNote || "");
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
        isPresent: (isWeeklyOff || isWorkFromHome) ? true : isPresent,
        checkIn: (isWeeklyOff || isWorkFromHome) ? null : (checkIn || null),
        checkOut: (isWeeklyOff || isWorkFromHome) ? null : (checkOut || null),
        isHalfDay: isPresent && isHalfDay && !isWeeklyOff && !isWorkFromHome,
        overtime: isPresent && isOvertime && !isWeeklyOff && !isWorkFromHome,
        isWeeklyOff: isWeeklyOff,
        isWorkFromHome: isWorkFromHome,
        shift1: isPresent && shift1 && !isWeeklyOff && !isWorkFromHome,
        shift2: isPresent && shift2 && !isWeeklyOff && !isWorkFromHome,
        shift3: isPresent && shift3 && !isWeeklyOff && !isWorkFromHome,
        notes: notes || null,
        status: (userRole === "HR" || userRole === "MANAGEMENT" || isWeeklyOff) ? "APPROVED" : "PENDING_VERIFICATION",
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

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      const attendanceDate = new Date(date || new Date());
      attendanceDate.setHours(0, 0, 0, 0);

      if (!currentAttendance?.id) {
        throw new Error("Attendance record not found");
      }

      // First, update the attendance data (PUT auto-approves for HR)
      const attendanceData: AttendanceFormData = {
        userId: userId || null,
        date: attendanceDate,
        isPresent: (isWeeklyOff || isWorkFromHome) ? true : isPresent,
        checkIn: (isWeeklyOff || isWorkFromHome) ? null : (checkIn || null),
        checkOut: (isWeeklyOff || isWorkFromHome) ? null : (checkOut || null),
        isHalfDay: isPresent && isHalfDay && !isWeeklyOff && !isWorkFromHome,
        overtime: isPresent && isOvertime && !isWeeklyOff && !isWorkFromHome,
        isWeeklyOff: isWeeklyOff,
        isWorkFromHome: isWorkFromHome,
        shift1: isPresent && shift1 && !isWeeklyOff && !isWorkFromHome,
        shift2: isPresent && shift2 && !isWeeklyOff && !isWorkFromHome,
        shift3: isPresent && shift3 && !isWeeklyOff && !isWorkFromHome,
        notes: notes || null,
        status: "APPROVED",
      };

      const updateResponse = await fetch(`/api/attendance/${currentAttendance.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(attendanceData),
      });

      if (!updateResponse.ok) {
        throw new Error("Failed to update attendance");
      }

      // Then add verification note if provided (PUT already approved it)
      if (verificationNote.trim()) {
        const noteResponse = await fetch(`/api/attendance/${currentAttendance.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "APPROVED",
            verificationNote: verificationNote.trim(),
          }),
        });

        if (!noteResponse.ok) {
          console.warn("Failed to add verification note, but attendance was approved");
        }
      }

      toast.success("Attendance approved successfully");
      onCloseAction();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to approve attendance");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      const attendanceDate = new Date(date || new Date());
      attendanceDate.setHours(0, 0, 0, 0);

      if (!currentAttendance?.id) {
        throw new Error("Attendance record not found");
      }

      // First, update the attendance data (PUT will auto-approve, but we'll override with PATCH)
      const attendanceData: AttendanceFormData = {
        userId: userId || null,
        date: attendanceDate,
        isPresent: (isWeeklyOff || isWorkFromHome) ? true : isPresent,
        checkIn: (isWeeklyOff || isWorkFromHome) ? null : (checkIn || null),
        checkOut: (isWeeklyOff || isWorkFromHome) ? null : (checkOut || null),
        isHalfDay: isPresent && isHalfDay && !isWeeklyOff && !isWorkFromHome,
        overtime: isPresent && isOvertime && !isWeeklyOff && !isWorkFromHome,
        isWeeklyOff: isWeeklyOff,
        isWorkFromHome: isWorkFromHome,
        shift1: isPresent && shift1 && !isWeeklyOff && !isWorkFromHome,
        shift2: isPresent && shift2 && !isWeeklyOff && !isWorkFromHome,
        shift3: isPresent && shift3 && !isWeeklyOff && !isWorkFromHome,
        notes: notes || null,
        status: "REJECTED",
      };

      const updateResponse = await fetch(`/api/attendance/${currentAttendance.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(attendanceData),
      });

      if (!updateResponse.ok) {
        throw new Error("Failed to update attendance");
      }

      // Then reject with verification note (override the auto-approval from PUT)
      const rejectResponse = await fetch(`/api/attendance/${currentAttendance.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "REJECTED",
          verificationNote: verificationNote.trim() || "Rejected by HR",
        }),
      });

      if (!rejectResponse.ok) {
        throw new Error("Failed to reject attendance");
      }

      toast.success("Attendance rejected successfully");
      onCloseAction();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to reject attendance");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePresentChange = (checked: boolean) => {
    setIsPresent(checked);
    if (!checked) {
      setIsHalfDay(false);
      setIsOvertime(false);
      setIsWeeklyOff(false);
      setIsWorkFromHome(false);
      setShift1(false);
      setShift2(false);
      setShift3(false);
    }
  };

  const handleWeeklyOffChange = (checked: boolean) => {
    setIsWeeklyOff(checked);
    if (checked) {
      setIsPresent(true);
      setIsHalfDay(false);
      setIsOvertime(false);
      setIsWorkFromHome(false);
      setShift1(false);
      setShift2(false);
      setShift3(false);
      setCheckIn("");
      setCheckOut("");
    }
  };

  const handleWorkFromHomeChange = (checked: boolean) => {
    setIsWorkFromHome(checked);
    if (checked) {
      setIsPresent(true);
      setIsHalfDay(false);
      setIsOvertime(false);
      setIsWeeklyOff(false);
      setShift1(false);
      setShift2(false);
      setShift3(false);
      setCheckIn("");
      setCheckOut("");
    }
  };

  // Check if it's a fixed weekly off day
  const isFixedWeeklyOffDay = userWeeklyOffConfig?.hasWeeklyOff && 
    userWeeklyOffConfig.weeklyOffType === "FIXED" && 
    date && 
    userWeeklyOffConfig.weeklyOffDay === new Date(date).getDay();

  const canOverrideWeeklyOff = ["HR", "MANAGEMENT"].includes(userRole || "");

  return (
    <Dialog open={isOpen} onOpenChange={onCloseAction}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {showApproveReject ? "Review Attendance" : "Mark Attendance"} for {userName} ({department})
          </DialogTitle>
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
                disabled={!isPresent || isWorkFromHome}
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
                disabled={!isPresent || isWorkFromHome}
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
                disabled={!isPresent || isWorkFromHome}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="shift2">11 AM to 7 PM</Label>
              <Switch 
                id="shift2"
                checked={shift2}
                onCheckedChange={setShift2}
                disabled={!isPresent || isWorkFromHome}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="shift3">7 PM to 11 PM</Label>
              <Switch 
                id="shift3"
                checked={shift3}
                onCheckedChange={setShift3}
                disabled={!isPresent || isWorkFromHome}
              />
            </div>
          </div>

          {userWeeklyOffConfig?.hasWeeklyOff && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="isWeeklyOff">
                  Weekly Off
                  {isFixedWeeklyOffDay && (
                    <span className="ml-2 text-xs text-muted-foreground">(Fixed weekly off day)</span>
                  )}
                </Label>
                <Switch 
                  id="isWeeklyOff" 
                  checked={isWeeklyOff}
                  onCheckedChange={handleWeeklyOffChange}
                  disabled={!canOverrideWeeklyOff && userWeeklyOffConfig.weeklyOffType === "FIXED" && !isFixedWeeklyOffDay}
                />
              </div>
            </div>
          )}

          {userWeeklyOffConfig?.hasWorkFromHome && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="isWorkFromHome">Work From Home</Label>
                <Switch 
                  id="isWorkFromHome" 
                  checked={isWorkFromHome}
                  onCheckedChange={handleWorkFromHomeChange}
                />
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="isHalfDay">Half Day</Label>
              <Switch 
                id="isHalfDay" 
                checked={isHalfDay}
                onCheckedChange={setIsHalfDay}
                disabled={!isPresent || isOvertime || isWeeklyOff || isWorkFromHome}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="overtime">Overtime</Label>
              <Switch 
                id="overtime" 
                checked={isOvertime}
                onCheckedChange={setIsOvertime}
                disabled={!isPresent || isHalfDay || isWeeklyOff || isWorkFromHome}
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

          {showApproveReject && (
            <div>
              <Label htmlFor="verificationNote">Verification Note (Optional)</Label>
              <Textarea
                id="verificationNote"
                value={verificationNote}
                onChange={(e) => setVerificationNote(e.target.value)}
                placeholder="Add a note about this verification..."
                className="mt-1"
                rows={2}
              />
            </div>
          )}

          {showApproveReject ? (
            <div className="flex gap-2">
              <Button 
                onClick={handleReject} 
                className="flex-1 bg-red-600 hover:bg-red-700 text-white" 
                disabled={isLoading}
              >
                {isLoading ? "Processing..." : "Reject"}
              </Button>
              <Button 
                onClick={handleApprove} 
                className="flex-1 bg-green-600 hover:bg-green-700 text-white" 
                disabled={isLoading}
              >
                {isLoading ? "Processing..." : "Approve"}
              </Button>
            </div>
          ) : (
            <Button 
              onClick={handleSubmit} 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : "Save Attendance"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 
