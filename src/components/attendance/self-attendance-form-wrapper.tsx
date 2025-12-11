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

  const getButtonText = () => {
    if (props.currentAttendance?.status === "REJECTED") {
      return "Resubmit Attendance";
    }
    return props.currentAttendance ? "Update Attendance" : "Mark Attendance";
  };

  return (
    <>
      <Button
        variant={props.currentAttendance?.status === "REJECTED" ? "destructive" : "outline"}
        className="w-full"
        onClick={() => setIsOpen(true)}
      >
        <CalendarCheck className="mr-2 h-4 w-4" />
        {getButtonText()}
      </Button>

      <AttendanceForm
        {...props}
        isOpen={isOpen}
        onCloseAction={() => setIsOpen(false)}
      />
    </>
  );
} 
