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
import { AttendanceForm } from "./attendance-form";

interface Attendance {
  isPresent: boolean;
  checkIn: string | null;
  checkOut: string | null;
  isHalfDay: boolean;
  overtime: boolean;
  shift1: boolean;
  shift2: boolean;
  shift3: boolean;
}

interface User {
  id: string;
  name: string | null;
  attendance?: Attendance[];
}

interface AttendanceTableProps {
  users: User[];
  date: Date;
}

const getAttendanceStatus = (user: User) => {
  if (!user.attendance?.length) return "PENDING";
  const attendance = user.attendance[0];
  if (!attendance.isPresent) return "ABSENT";
  if (attendance.isHalfDay) return "HALF_DAY";
  return "PRESENT";
};

const statusColors = {
  PRESENT: "bg-green-100 text-green-800",
  ABSENT: "bg-red-100 text-red-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  HALF_DAY: "bg-blue-100 text-blue-800",
} as const;

export function AttendanceTable({ users, date }: AttendanceTableProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Check In</TableHead>
            <TableHead>Check Out</TableHead>
            <TableHead>Shifts</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const status = getAttendanceStatus(user);
            const attendance = user.attendance?.[0];
            return (
              <TableRow
                key={user.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelectedUser(user)}
              >
                <TableCell>{user.name}</TableCell>
                <TableCell>
                  <Badge className={statusColors[status]}>
                    {status}
                  </Badge>
                </TableCell>
                <TableCell>{attendance?.checkIn || "-"}</TableCell>
                <TableCell>{attendance?.checkOut || "-"}</TableCell>
                <TableCell>
                  {attendance?.isPresent ? (
                    <>
                      {attendance.shift1 && "Morning "}
                      {attendance.shift2 && "Afternoon "}
                      {attendance.shift3 && "Night"}
                    </>
                  ) : "-"}
                </TableCell>
                <TableCell>
                  {attendance?.isPresent ? (
                    <>
                      {attendance.isHalfDay && "Half Day "}
                      {attendance.overtime && "Overtime"}
                    </>
                  ) : "-"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {selectedUser && (
        <AttendanceForm
          userId={selectedUser.id}
          userName={selectedUser.name || ""}
          date={date}
          currentAttendance={selectedUser.attendance?.[0]}
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </>
  );
} 