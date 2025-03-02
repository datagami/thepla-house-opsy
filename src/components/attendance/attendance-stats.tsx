"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {Attendance} from "@/models/models";

interface AttendanceStatsProps {
  attendance: Attendance[];
  month: Date;
}

interface WeeklyStats {
  week: string;
  present: number;
  absent: number;
  halfDay: number;
  overtime: number;
}

export function AttendanceStats({ attendance }: AttendanceStatsProps) {
  // Calculate weekly stats
  const weeklyStats = attendance.reduce((acc, curr) => {
    const week = Math.floor(new Date(curr.date).getDate() / 7);
    if (!acc[week]) {
      acc[week] = {
        week: `Week ${week + 1}`,
        present: 0,
        absent: 0,
        halfDay: 0,
        overtime: 0,
      };
    }

    if (curr.isPresent) acc[week].present++;
    else acc[week].absent++;
    if (curr.isHalfDay) acc[week].halfDay++;
    if (curr.overtime) acc[week].overtime++;

    return acc;
  }, {} as Record<number, WeeklyStats>);

  const data = Object.values(weeklyStats);

  return (
    <div className="h-[300px] w-full mt-6">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="week" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="present" name="Present" fill="#22c55e" />
          <Bar dataKey="absent" name="Absent" fill="#ef4444" />
          <Bar dataKey="halfDay" name="Half Day" fill="#3b82f6" />
          <Bar dataKey="overtime" name="Overtime" fill="#a855f7" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
} 
