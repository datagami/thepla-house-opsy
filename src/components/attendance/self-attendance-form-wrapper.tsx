"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarCheck } from "lucide-react";
import { AttendanceForm } from "@/components/attendance/attendance-form";
import { AttendanceFormProps } from "@/models/attendance";
import {Attendance} from "@/models/models";

interface SelfAttendanceFormWrapperProps extends Omit<AttendanceFormProps, "isOpen" | "onCloseAction"> {
  currentAttendance?: Attendance;
}

export function SelfAttendanceFormWrapper(props: SelfAttendanceFormWrapperProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setIsOpen(true)}
      >
        <CalendarCheck className="mr-2 h-4 w-4" />
        {props.currentAttendance ? "Update Attendance" : "Mark Attendance"}
      </Button>

      <AttendanceForm
        {...props}
        isOpen={isOpen}
        onCloseAction={() => setIsOpen(false)}
      />
    </>
  );
} 
