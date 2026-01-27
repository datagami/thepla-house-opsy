"use client";

import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { getShiftDisplay } from "@/lib/utils/shift-display";

interface Attendance {
  id: string;
  date: Date;
  isPresent: boolean;
  isWeeklyOff?: boolean;
  isWorkFromHome?: boolean;
  isHalfDay: boolean;
  overtime: boolean;
  checkIn: string | null;
  checkOut: string | null;
  shift1: boolean;
  shift2: boolean;
  shift3: boolean;
  status: string;
}

interface AttendanceCalendarProps {
  attendance: Attendance[];
  month: Date;
}

export function AttendanceCalendar({ attendance, month }: AttendanceCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const attendanceMap = new Map(
    attendance.map(a => [format(new Date(a.date), "yyyy-MM-dd"), a])
  );

  // const getDayClass = (date: Date): string => {
  //   const dateStr = format(date, "yyyy-MM-dd");
  //   const attendance = attendanceMap.get(dateStr);
  //
  //   if (!attendance) return "";
  //
  //   if (attendance.isHalfDay) return "bg-blue-100";
  //   if (attendance.overtime) return "bg-purple-100";
  //   return attendance.isPresent ? "bg-green-100" : "bg-red-100";
  // };

  return (
    <div className="space-y-4">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={setSelectedDate}
        month={month}
        className="rounded-md border"
        classNames={{
          day_today: "bg-accent text-accent-foreground",
          day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        }}
      />

      {selectedDate && (
        <div className="rounded-md border p-4">
          <h4 className="font-medium mb-2">
            {format(selectedDate, "dd MMMM yyyy")}
          </h4>
          {(() => {
            const attendance = attendanceMap.get(format(selectedDate, "yyyy-MM-dd"));
            if (!attendance) return <p>No attendance record</p>;

            return (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {attendance.isWeeklyOff ? (
                    <Badge className="bg-purple-100 text-purple-800">Weekly Off</Badge>
                  ) : attendance.isWorkFromHome ? (
                    <Badge className="bg-teal-100 text-teal-800">Work From Home</Badge>
                  ) : (
                    <Badge variant={attendance.isPresent ? "default" : "destructive"}>
                      {attendance.isPresent ? "Present" : "Absent"}
                    </Badge>
                  )}
                  {attendance.isHalfDay && <Badge>Half Day</Badge>}
                  {attendance.overtime && <Badge variant="outline">Overtime</Badge>}
                </div>
                {attendance.isPresent && !attendance.isWeeklyOff && !attendance.isWorkFromHome && (
                  <>
                    <p className="text-sm">
                      Time: {attendance.checkIn} - {attendance.checkOut}
                    </p>
                    <p className="text-sm">
                      Shifts: {getShiftDisplay(attendance.shift1, attendance.shift2, attendance.shift3)}
                    </p>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
} 
