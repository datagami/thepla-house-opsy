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
import { getShiftDisplay } from "@/lib/utils/shift-display";


interface SharedAttendanceTableProps {
  users: User[];
  date: Date;
  showBranch?: boolean;
  showRole?: boolean;
  isHR?: boolean;
  userRole: string;
}

export function SharedAttendanceTable({ 
  users, 
  date,
  showBranch = false,
  showRole = false,
  isHR = false,
  userRole,
}: SharedAttendanceTableProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const getAttendanceStatus = (user: User) => {
    if (!user.attendance?.length) return "PENDING";
    const attendance = user.attendance[0];
    if (!attendance.isPresent) return "ABSENT";
    if (attendance.isWeeklyOff) return "WEEKLY_OFF";
    if ((attendance as { isWorkFromHome?: boolean }).isWorkFromHome) return "WORK_FROM_HOME";
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
    WEEKLY_OFF: "bg-purple-100 text-purple-800",
    WORK_FROM_HOME: "bg-teal-100 text-teal-800",
    APPROVED: "bg-emerald-100 text-emerald-800",
    REJECTED: "bg-red-100 text-red-800",
  } as const;

  const roleColors = {
    EMPLOYEE: "text-blue-600 bg-blue-100",
    BRANCH_MANAGER: "text-purple-600 bg-purple-100",
    HR: "text-green-600 bg-green-100",
    MANAGEMENT: "text-orange-600 bg-orange-100",
  } as const;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            {showRole && <TableHead>Role</TableHead>}
            {showBranch && <TableHead>Branch</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Check In</TableHead>
            <TableHead>Check Out</TableHead>
            <TableHead>Shifts</TableHead>
            <TableHead>Weekly Off</TableHead>
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
                {showRole && (
                  <TableCell>
                    <Badge variant="secondary" className={roleColors[user.role as keyof typeof roleColors]}>
                      {user.role}
                    </Badge>
                  </TableCell>
                )}
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
                    getShiftDisplay(attendance.shift1, attendance.shift2, attendance.shift3)
                  ) : "-"}
                </TableCell>
                <TableCell>
                  {(attendance as { isWorkFromHome?: boolean })?.isWorkFromHome ? (
                    <Badge variant="outline" className="bg-teal-100 text-teal-800">
                      Work From Home
                    </Badge>
                  ) : attendance?.isWeeklyOff ? (
                    <Badge variant="outline" className="bg-purple-100 text-purple-800">
                      Weekly Off
                    </Badge>
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
          userRole={userRole}
        />
      )}
    </>
  );
} 
