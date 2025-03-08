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

export function AttendanceStats({ attendance, month }: AttendanceStatsProps) {
  // Calculate weekly stats
  const weeklyStats = attendance.reduce((acc, curr) => {
    const date = new Date(curr.date);
    
    // Get the first day of the month
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    
    // Calculate week number (0-based)
    // Adding the day of week of the first day to get complete weeks
    const firstDayOffset = firstDay.getDay();
    const dayOfMonth = date.getDate() - 1; // 0-based day of month
    
    // Calculate which week the date belongs to (Saturday is end of week)
    // We add firstDayOffset to account for partial first week
    const week = Math.floor((dayOfMonth + firstDayOffset) / 7);
    
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

  // Convert to array and sort by week number
  const data = Object.values(weeklyStats).sort((a, b) => 
    parseInt(a.week.split(' ')[1]) - parseInt(b.week.split(' ')[1])
  );

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
