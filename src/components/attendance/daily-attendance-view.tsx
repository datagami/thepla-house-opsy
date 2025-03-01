"use client";

import { AttendanceTable } from "./attendance-table";
import {User} from "@prisma/client";


interface DailyAttendanceViewProps {
  users: User[];
}

export function DailyAttendanceView({ users }: DailyAttendanceViewProps) {
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
