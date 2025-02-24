"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface AttendanceFormProps {
  userId: string;
  date: Date;
  onSuccess: () => void;
}

export function AttendanceForm({ userId, date, onSuccess }: AttendanceFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isPresent, setIsPresent] = useState(false);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [isOvertime, setIsOvertime] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const checkIn = formData.get("checkIn") as string;
      const checkOut = formData.get("checkOut") as string;

      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          date,
          checkIn: isPresent && checkIn ? checkIn : null,
          checkOut: isPresent && checkOut ? checkOut : null,
          isHalfDay: isPresent && isHalfDay,
          overtime: isPresent && isOvertime,
          shift1: isPresent && formData.get("shift1") === "true",
          shift2: isPresent && formData.get("shift2") === "true",
          shift3: isPresent && formData.get("shift3") === "true",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark attendance");
      }

      toast.success("Attendance marked successfully");
      router.refresh();
      onSuccess();
    } catch (error) {
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
    }
  };

  const handleHalfDayChange = (checked: boolean) => {
    setIsHalfDay(checked);
    if (checked) {
      setIsOvertime(false);
    }
  };

  const handleOvertimeChange = (checked: boolean) => {
    setIsOvertime(checked);
    if (checked) {
      setIsHalfDay(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
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
          <Label htmlFor="checkIn">Check In Time (Optional)</Label>
          <Input
            id="checkIn"
            name="checkIn"
            type="time"
            disabled={!isPresent}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="checkOut">Check Out Time (Optional)</Label>
          <Input
            id="checkOut"
            name="checkOut"
            type="time"
            disabled={!isPresent}
            className="mt-1"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="shift1">Shift 1 (Morning)</Label>
          <Switch 
            id="shift1" 
            name="shift1" 
            disabled={!isPresent}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="shift2">Shift 2 (Afternoon)</Label>
          <Switch 
            id="shift2" 
            name="shift2" 
            disabled={!isPresent}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="shift3">Shift 3 (Night)</Label>
          <Switch 
            id="shift3" 
            name="shift3" 
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
            onCheckedChange={handleHalfDayChange}
            disabled={!isPresent || isOvertime}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="overtime">Overtime</Label>
          <Switch 
            id="overtime" 
            checked={isOvertime}
            onCheckedChange={handleOvertimeChange}
            disabled={!isPresent || isHalfDay}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Marking..." : "Mark Attendance"}
      </Button>
    </form>
  );
} 