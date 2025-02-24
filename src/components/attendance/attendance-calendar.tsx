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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AttendanceStatus } from "./attendance-status";
import { AttendanceEditDialog } from "./attendance-edit-dialog";

interface User {
  id: string;
  name: string;
  attendance: Array<{
    date: Date;
    checkIn: Date;
    checkOut: Date | null;
    isHalfDay: boolean;
    overtime: number;
    shift1: boolean;
    shift2: boolean;
    shift3: boolean;
  }>;
}

interface AttendanceCalendarProps {
  users: User[];
}

export function AttendanceCalendar({ users }: AttendanceCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPreviousDay}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextDay}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Employee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Shifts</TableHead>
              <TableHead>Overtime</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const attendance = user.attendance.find(
                (a) => new Date(a.date).toDateString() === selectedDate.toDateString()
              );

              const getShifts = (attendance: typeof user.attendance[0]) => {
                if (!attendance) return "-";
                const shifts = [];
                if (attendance.shift1) shifts.push("1");
                if (attendance.shift2) shifts.push("2");
                if (attendance.shift3) shifts.push("3");
                return shifts.length ? `Shift ${shifts.join(", ")}` : "-";
              };

              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>
                    <AttendanceStatus
                      attendance={attendance}
                      userId={user.id}
                      date={selectedDate}
                    />
                  </TableCell>
                  <TableCell>
                    {attendance?.checkIn ? format(new Date(attendance.checkIn), "hh:mm a") : "-"}
                  </TableCell>
                  <TableCell>
                    {attendance?.checkOut ? format(new Date(attendance.checkOut), "hh:mm a") : "-"}
                  </TableCell>
                  <TableCell>{getShifts(attendance)}</TableCell>
                  <TableCell>
                    {attendance?.overtime ? "Yes" : "No"}
                  </TableCell>
                  <TableCell className="text-right">
                    <AttendanceEditDialog attendance={attendance} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 