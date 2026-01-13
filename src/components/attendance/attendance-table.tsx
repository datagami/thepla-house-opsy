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
import {User} from "@/models/models";
import { getShiftDisplay } from "@/lib/utils/shift-display";


interface AttendanceTableProps {
  users: User[];
  date: Date;
  viewOnly?: boolean;
}

const statusColors = {
  'PRESENT': "bg-green-100 text-green-800",
  'ABSENT': "bg-red-100 text-red-800",
  'PENDING_VERIFICATION': "bg-yellow-100 text-yellow-800",
  'APPROVED': "bg-emerald-100 text-emerald-800",
  'REJECTED': "bg-rose-100 text-rose-800",
} as const;

export function AttendanceTable({ users, date, viewOnly = false }: AttendanceTableProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const getAttendanceStatus = (user: User) => {
    if (!user.attendance.length) return "PENDING";
    return user.attendance[0].isPresent ? "PRESENT" : "ABSENT";
  };

  const getShifts = (attendance: User['attendance'][0]) => {
    return getShiftDisplay(attendance.shift1, attendance.shift2, attendance.shift3);
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Shifts</TableHead>
            <TableHead>Weekly Off</TableHead>
            <TableHead>Half Day</TableHead>
            <TableHead>Overtime</TableHead>
            <TableHead>Verification</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const attendance = user.attendance[0];
            const status = getAttendanceStatus(user);
            return (
              <TableRow
                key={user.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelectedUser(user)}
              >
                <TableCell>{user.name}</TableCell>
                <TableCell>
                  {user.department?.name || 'N/A'}
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[status as keyof typeof statusColors]}>
                    {status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {attendance?.checkIn && attendance?.checkOut
                    ? `${attendance.checkIn} - ${attendance.checkOut}`
                    : "-"}
                </TableCell>
                <TableCell>
                  {attendance ? getShifts(attendance) : "-"}
                </TableCell>
                <TableCell>
                  {attendance?.isWeeklyOff ? (
                    <Badge variant="outline" className="bg-purple-100 text-purple-800">
                      Weekly Off
                    </Badge>
                  ) : "-"}
                </TableCell>
                <TableCell>
                  {attendance?.isHalfDay ? (
                    <Badge variant="outline" className="bg-blue-100 text-blue-800">
                      Half Day
                    </Badge>
                  ) : "-"}
                </TableCell>
                <TableCell>
                  {attendance?.overtime ? (
                    <Badge variant="outline" className="bg-purple-100 text-purple-800">
                      Overtime
                    </Badge>
                  ) : "-"}
                </TableCell>
                <TableCell>
                  {attendance && (
                    <div className="flex flex-col gap-1">
                      <Badge className={statusColors[attendance.status] as string || ''}>
                        {attendance.status}
                      </Badge>
                      {attendance.verifiedAt && attendance.verifiedBy && (
                        <span className="text-xs text-muted-foreground">
                          Verified by {attendance.verifiedBy.name} at{" "}
                          {format(new Date(attendance.verifiedAt), "dd/MM/yyyy HH:mm")}
                        </span>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {selectedUser && !viewOnly && (
        <AttendanceForm
          userId={selectedUser.id}
          userName={selectedUser.name}
          userRole={selectedUser.role}
          department={selectedUser.department?.name || ''}
          date={date}
          currentAttendance={selectedUser.attendance[0]}
          isOpen={!!selectedUser && !viewOnly}
          onCloseAction={() => setSelectedUser(null)}
        />
      )}
    </>
  );
} 
