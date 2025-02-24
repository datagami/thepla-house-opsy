"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AttendanceForm } from "./attendance-form";
import { AttendanceEditDialog } from "./attendance-edit-dialog";

interface AttendanceStatusProps {
  attendance?: {
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
  };
  userId: string;
  date: Date;
}

export function AttendanceStatus({ attendance, userId, date }: AttendanceStatusProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!attendance) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Badge variant="destructive">Mark Attendance</Badge>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Attendance</DialogTitle>
          </DialogHeader>
          <AttendanceForm userId={userId} date={date} onSuccess={() => setIsOpen(false)} />
        </DialogContent>
      </Dialog>
    );
  }

  const getBadgeVariant = () => {
    if (!attendance.isPresent) return "destructive";
    if (attendance.isHalfDay) return "warning";
    if (attendance.overtime) return "default";
    return "success";
  };

  const getBadgeText = () => {
    if (!attendance.isPresent) return "Absent";
    if (attendance.isHalfDay) return "Half Day";
    if (attendance.overtime) return "Overtime";
    return "Present";
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Badge variant={getBadgeVariant()}>{getBadgeText()}</Badge>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Attendance</DialogTitle>
        </DialogHeader>
        <AttendanceEditDialog 
          attendance={attendance} 
          onSuccess={() => setIsOpen(false)} 
        />
      </DialogContent>
    </Dialog>
  );
} 
