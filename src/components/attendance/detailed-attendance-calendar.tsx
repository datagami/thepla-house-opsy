"use client";

import { eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Attendance } from "@/models/models";
import { useState } from "react";
import { AttendanceForm } from "./attendance-form";
import { Badge } from "@/components/ui/badge";

interface DetailedAttendanceCalendarProps {
  attendance: Attendance[];
  month: Date;
  userId: string;
  userName: string;
  userRole: string;
}

export function DetailedAttendanceCalendar({ 
  attendance, 
  month,
  userId,
  userName,
  userRole
}: DetailedAttendanceCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedAttendance, setSelectedAttendance] = useState<Attendance | null>(null);

  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  const firstDayOfMonth = getDay(startOfMonth(month));
  const paddingDays = Array(firstDayOfMonth).fill(null);

  const attendanceMap = new Map(
    attendance.map((record) => [
      format(new Date(record.date), "yyyy-MM-dd"),
      record,
    ])
  );

  const handleDateClick = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const existingAttendance = attendanceMap.get(dateKey);
    setSelectedDate(date);
    setSelectedAttendance(existingAttendance || null);
  };

  const getAttendanceStatus = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const record = attendanceMap.get(dateKey);
    if (!record) return "PENDING";
    if (!record.isPresent) return "ABSENT";
    if (record.isHalfDay) return "HALF_DAY";
    return "PRESENT";
  };

  const statusColors = {
    PRESENT: "bg-green-100 text-green-800",
    ABSENT: "bg-red-100 text-red-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    HALF_DAY: "bg-blue-100 text-blue-800",
  } as const;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="p-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {paddingDays.map((_, index) => (
          <div key={`padding-${index}`} className="p-2" />
        ))}
        {days.map((date) => {
          const dateKey = format(date, "yyyy-MM-dd");
          const attendance = attendanceMap.get(dateKey);
          const status = getAttendanceStatus(date);
          const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

          return (
            <div
              key={date.toString()}
              className={cn(
                "p-2 cursor-pointer rounded-md hover:bg-muted/50 transition-colors",
                isToday && "ring-2 ring-primary",
                statusColors[status]
              )}
              onClick={() => handleDateClick(date)}
            >
              <div className="text-sm font-medium text-center">{format(date, "d")}</div>
              {attendance && (
                <div className="mt-1 space-y-1">
                  {attendance.isPresent && (
                    <div className="flex flex-col gap-1">
                      <div className="text-xs">
                        {attendance.checkIn && attendance.checkOut
                          ? `${attendance.checkIn} - ${attendance.checkOut}`
                          : "No time record"}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {attendance.shift1 && (
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            M
                          </Badge>
                        )}
                        {attendance.shift2 && (
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            A
                          </Badge>
                        )}
                        {attendance.shift3 && (
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            N
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {attendance.isHalfDay && (
                          <Badge variant="outline" className="text-xs px-1 py-0 bg-blue-100 text-blue-800">
                            HD
                          </Badge>
                        )}
                        {attendance.overtime && (
                          <Badge variant="outline" className="text-xs px-1 py-0 bg-purple-100 text-purple-800">
                            OT
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedDate && (
        <AttendanceForm
          userId={userId}
          userName={userName}
          date={selectedDate}
          currentAttendance={selectedAttendance || undefined}
          isOpen={!!selectedDate}
          onCloseAction={() => {
            setSelectedDate(null);
            setSelectedAttendance(null);
          }}
          userRole={userRole}
        />
      )}
    </div>
  );
} 
