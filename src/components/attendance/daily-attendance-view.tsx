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
  name: string | null;
  attendance: Attendance[];
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
  const presentUsers = users.filter(user => user.attendance[0]?.isPresent);
  const absentUsers = users.filter(user => !user.attendance[0]?.isPresent);

  const AttendanceTable = ({ users, title }: { users: User[], title: string }) => (
    <div>
      <h3 className="text-lg font-medium mb-4">{title}</h3>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Shifts</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Verification</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const attendance = user.attendance[0];
              return (
                <TableRow
                  key={user.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedUser(user)}
                >
                  <TableCell>{user.name}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[getStatus(attendance)]}>
                      {getStatus(attendance)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {attendance.checkIn && attendance.checkOut ? (
                      `${attendance.checkIn} - ${attendance.checkOut}`
                    ) : "-"}
                  </TableCell>
                  <TableCell>{getShifts(attendance)}</TableCell>
                  <TableCell>
                    {attendance.overtime ? "Overtime" : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge className={statusColors[attendance.status]}>
                        {attendance.status}
                      </Badge>
                      {attendance.verifiedAt && (
                        <span className="text-xs text-muted-foreground">
                          Verified by {attendance.verifiedBy?.name} at{" "}
                          {format(new Date(attendance.verifiedAt), "dd/MM/yyyy HH:mm")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-8">
          <AttendanceTable 
            users={presentUsers} 
            title={`Present Employees (${presentUsers.length})`} 
          />
          <AttendanceTable 
            users={absentUsers} 
            title={`Absent Employees (${absentUsers.length})`} 
          />
        </div>
      </div>

      {selectedUser && (
        <AttendanceForm
          userId={selectedUser.id}
          userName={selectedUser.name || ""}
          date={new Date()}
          currentAttendance={selectedUser.attendance[0]}
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </>
  );
} 