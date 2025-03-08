"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {Attendance, User} from "@/models/models";
import { calculateMonthlySalary } from "@/lib/services/salary-calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface AttendanceStatsProps {
  attendance: Attendance[];
  month: Date;
  user: User;
}

interface WeeklyStats {
  week: string;
  present: number;
  absent: number;
  halfDay: number;
  overtime: number;
}

export function AttendanceStats({ attendance, month, user }: AttendanceStatsProps) {
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

  // Check if month has ended
  const today = new Date();
  const isMonthEnded = month.getMonth() < today.getMonth() || 
                       month.getFullYear() < today.getFullYear();

  // Calculate salary breakup if month has ended
  const salaryBreakup = isMonthEnded ? calculateMonthlySalary(attendance, user?.salary) : null;

  return (
    <div className="space-y-6">
      {salaryBreakup && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Total Salary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(salaryBreakup.totalSalary)}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Basic: {formatCurrency(salaryBreakup.basicSalary)}</p>
                  <p>Per Day: {formatCurrency(salaryBreakup.perDaySalary)}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Regular Days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(salaryBreakup.regularDaysAmount)}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Full Days ({salaryBreakup.presentDays}): {formatCurrency(salaryBreakup.fullDayAmount)}</p>
                  <p>Half Days ({salaryBreakup.halfDays}): {formatCurrency(salaryBreakup.halfDayAmount)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Overtime Days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(salaryBreakup.overtimeAmount)}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Days: {salaryBreakup.overtimeDays}</p>
                  <p>Rate: 1.5x per day</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Deductions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {formatCurrency(salaryBreakup.deductions)}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Absent Days: {salaryBreakup.absentDays}</p>
                  <p>Rate: 1x per day</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Attendance Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Full Days:</span>
                    <span className="font-medium">{salaryBreakup.presentDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Half Days:</span>
                    <span className="font-medium">{salaryBreakup.halfDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Overtime Days:</span>
                    <span className="font-medium">{salaryBreakup.overtimeDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Absent Days:</span>
                    <span className="font-medium">{salaryBreakup.absentDays}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div className="h-[300px] w-full">
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
    </div>
  );
} 
