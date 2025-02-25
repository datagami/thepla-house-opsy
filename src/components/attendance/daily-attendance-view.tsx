"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { AttendanceForm } from "./attendance-form";
import { AttendanceTable } from "./attendance-table";

interface Attendance {
  id: string;
  isPresent: boolean;
  checkIn: string | null;
  checkOut: string | null;
  isHalfDay: boolean;
  overtime: boolean;
  shift1: boolean;
  shift2: boolean;
  shift3: boolean;
  status: string;
  verifiedAt: Date | null;
  verifiedBy?: {
    name: string | null;
  } | null;
}

interface User {
  id: string;
  name: string;
  attendance: {
    id: string;
    isPresent: boolean;
    checkIn: string | null;
    checkOut: string | null;
    isHalfDay: boolean;
    overtime: boolean;
    shift1: boolean;
    shift2: boolean;
    shift3: boolean;
    status: string;
  }[];
}

interface DailyAttendanceViewProps {
  users: User[];
}

const getShifts = (attendance: Attendance) => {
  const shifts = [];
  if (attendance.shift1) shifts.push("Morning");
  if (attendance.shift2) shifts.push("Afternoon");
  if (attendance.shift3) shifts.push("Night");
  return shifts.join(", ") || "-";
};

const getStatus = (attendance: Attendance) => {
  if (attendance.isHalfDay) return "HALF_DAY";
  return attendance.isPresent ? "PRESENT" : "ABSENT";
};

const statusColors = {
  PRESENT: "bg-green-100 text-green-800",
  ABSENT: "bg-red-100 text-red-800",
  HALF_DAY: "bg-blue-100 text-blue-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
} as const;

export function DailyAttendanceView({ users }: DailyAttendanceViewProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const presentUsers = users.filter(user => user.attendance[0].isPresent);
  const absentUsers = users.filter(user => !user.attendance[0].isPresent);

  return (
    <div className="space-y-8">
      {presentUsers.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Present ({presentUsers.length})</h3>
          <div className="rounded-md border">
            <AttendanceTable users={presentUsers} date={new Date()} />
          </div>
        </div>
      )}

      {absentUsers.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Absent ({absentUsers.length})</h3>
          <div className="rounded-md border">
            <AttendanceTable users={absentUsers} date={new Date()} />
          </div>
        </div>
      )}
    </div>
  );
} 