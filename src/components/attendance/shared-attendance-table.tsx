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
import {User} from "@/models/models";


interface SharedAttendanceTableProps {
  users: User[];
  date: Date;
  showBranch?: boolean;
  isHR?: boolean;
  userRole: string;
}

export function SharedAttendanceTable({ 
  users, 
  date,
  showBranch = false,
  isHR = false,
  userRole,
}: SharedAttendanceTableProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const getAttendanceStatus = (user: User) => {
    if (!user.attendance?.length) return "PENDING";
    const attendance = user.attendance[0];
    if (!attendance.isPresent) return "ABSENT";
    if (attendance.isHalfDay) return "HALF_DAY";
    return "PRESENT";
  };

  const getVerificationStatus = (user: User) => {
    if (!user.attendance?.length) return null;
    return user.attendance[0].status;
  };

  const statusColors = {
    PRESENT: "bg-green-100 text-green-800",
    ABSENT: "bg-red-100 text-red-800",
    PENDING_VERIFICATION: "bg-yellow-100 text-yellow-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    HALF_DAY: "bg-blue-100 text-blue-800",
    APPROVED: "bg-emerald-100 text-emerald-800",
    REJECTED: "bg-red-100 text-red-800",
  } as const;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            {showBranch && <TableHead>Branch</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Check In</TableHead>
            <TableHead>Check Out</TableHead>
            <TableHead>Shifts</TableHead>
            <TableHead>Notes</TableHead>
            {isHR && <TableHead>Verification</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const status = getAttendanceStatus(user);
            const verificationStatus = getVerificationStatus(user);
            const attendance = user.attendance?.[0];
            return (
              <TableRow
                key={user.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelectedUser(user)}
              >
                <TableCell>{user.name}</TableCell>
                {showBranch && (
                  <TableCell>{user.branch?.name || "-"}</TableCell>
                )}
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
                {isHR && (
                  <TableCell>
                    {verificationStatus && (
                      <Badge className={statusColors[verificationStatus]}>
                        {verificationStatus}
                      </Badge>
                    )}
                  </TableCell>
                )}
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
          department={selectedUser.department?.name || ''}
          onCloseAction={() => setSelectedUser(null)}
          isHR={userRole === "HR"}
        />
      )}
    </>
  );
} 
