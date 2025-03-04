"use client";

import { AttendanceTable } from "./attendance-table";
import {User} from "@/models/models";


interface DailyAttendanceViewProps {
  markedUsers: User[];
  pendingUsers: User[];
  viewOnly?: boolean;
}

export function DailyAttendanceView({ markedUsers,  pendingUsers, viewOnly = false }: DailyAttendanceViewProps) {
  const presentUsers = markedUsers.filter(user => user.attendance[0].isPresent);
  const absentUsers = markedUsers.filter(user => !user.attendance[0].isPresent);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Marked Attendance ({markedUsers.length})</h3>
      </div>

      {presentUsers.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Present ({presentUsers.length})</h3>
          <div className="rounded-md border">
            <AttendanceTable users={presentUsers} date={new Date()} viewOnly={viewOnly} />
          </div>
        </div>
      )}

      {absentUsers.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Absent ({absentUsers.length})</h3>
          <div className="rounded-md border">
            <AttendanceTable users={absentUsers} date={new Date()} viewOnly={viewOnly} />
          </div>
        </div>
      )}

      {pendingUsers.length > 0 && viewOnly && (
        <div>
          <h3 className="text-lg font-medium mb-4">Pending ({pendingUsers.length})</h3>
          <div className="rounded-md border">
            <AttendanceTable users={pendingUsers} date={new Date()} viewOnly={viewOnly} />
          </div>
        </div>
      )}
    </div>
  );
} 
