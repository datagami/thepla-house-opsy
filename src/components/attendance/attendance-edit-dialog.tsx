"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Edit } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {Attendance} from "@/models/models";

interface AttendanceEditDialogProps {
  attendance?: Attendance;
  userId?: string;
  date: Date;
}

export function AttendanceEditDialog({ attendance }: AttendanceEditDialogProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isPresent, setIsPresent] = useState(attendance?.isPresent ?? false);
  const [isHalfDay, setIsHalfDay] = useState(attendance?.isHalfDay ?? false);
  const [isOvertime, setIsOvertime] = useState(attendance?.overtime ?? false);

  const formatTimeForInput = (date: string | undefined | null) => {
    if (!date) return "";
    return new Date(date).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const checkIn = formData.get("checkIn") as string;
      const checkOut = formData.get("checkOut") as string;

      const response = await fetch(`/api/attendance/${attendance?.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isPresent,
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
        throw new Error("Failed to update attendance");
      }

      toast.success("Attendance updated successfully");
      router.refresh();
      setIsOpen(false);
    } catch (error) {
      console.log(error);
      toast.error("Failed to update attendance");
    } finally {
      setIsLoading(false);
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Attendance</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="isPresent">Present</Label>
            <Switch 
              id="isPresent"
              checked={isPresent}
              onCheckedChange={setIsPresent}
            />
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="checkIn">Check In Time (Optional)</Label>
              <Input
                id="checkIn"
                name="checkIn"
                type="time"
                defaultValue={formatTimeForInput(attendance?.checkIn)}
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
                defaultValue={formatTimeForInput(attendance?.checkOut)}
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
                defaultChecked={attendance?.shift1}
                disabled={!isPresent}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="shift2">Shift 2 (Afternoon)</Label>
              <Switch 
                id="shift2" 
                name="shift2"
                defaultChecked={attendance?.shift2}
                disabled={!isPresent}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="shift3">Shift 3 (Night)</Label>
              <Switch 
                id="shift3" 
                name="shift3"
                defaultChecked={attendance?.shift3}
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
            {isLoading ? "Updating..." : "Update Attendance"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
} 
