"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Attendance, User } from "@/models/models";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AttendanceStatsProps {
  attendance: Attendance[];
  month: Date;
  user: User;
}

interface WeeklyStats {
  week: string;
  present: number;
  halfDay: number;
  overtime: number;
}

export function AttendanceStats({ attendance }: AttendanceStatsProps) {
  // Calculate weekly stats
  const weeklyStats = attendance.reduce((acc, curr) => {
    const date = new Date(curr.date);
    const week = Math.floor((date.getDate() - 1) / 7);
    
    if (!acc[week]) {
      acc[week] = {
        week: `Week ${week + 1}`,
        present: 0,
        halfDay: 0,
        overtime: 0,
      };
    }

    if (!curr.isPresent) return acc;

    if (curr.isHalfDay) {
      acc[week].present += 0.5;
      acc[week].halfDay += 1;
      return acc;
    }

    if (curr.overtime) {
      acc[week].overtime += 1;
      acc[week].present += 1;
      return acc;
    }

    acc[week].present += 1;
    return acc;
  }, {} as Record<number, WeeklyStats>);

  // Convert to array and sort by week number
  const data = Object.values(weeklyStats).sort((a, b) => 
    parseInt(a.week.split(' ')[1]) - parseInt(b.week.split(' ')[1])
  );

  // Initialize counters for monthly stats
  let presentDays = 0;
  let overtimeDays = 0;
  let halfDays = 0;

  attendance.forEach(day => {
    if (!day.isPresent) {
      return;
    }

    if (day.isHalfDay) {
      presentDays += 0.5;
      halfDays += 1;
      return;
    }

    if (day.overtime) {
      overtimeDays++;
      presentDays += 1;
      return;
    }

    presentDays++;
  });

  let leavesEarned = 0;
  if (presentDays >= 25) {
    leavesEarned = 2;
  } else if (presentDays >= 15) {
    leavesEarned = 1;
  }

  // Calculate monthly stats
  const monthlyStats = {
    totalDays: attendance.length,
    presentDays: parseFloat(presentDays.toFixed(2)),
    halfDays,
    overtimeDays,
    leavesEarned,
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyStats.totalDays}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{monthlyStats.presentDays}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Half Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{monthlyStats.halfDays}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overtime Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{monthlyStats.overtimeDays}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leaves Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{monthlyStats.leavesEarned}</div>
          </CardContent>
        </Card>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="present" name="Present" fill="#22c55e" />
            <Bar dataKey="halfDay" name="Half Day" fill="#3b82f6" />
            <Bar dataKey="overtime" name="Overtime" fill="#a855f7" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
} 
