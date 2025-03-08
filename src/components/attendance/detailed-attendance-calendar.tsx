import { eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import {Attendance} from "@/models/models";

interface DetailedAttendanceCalendarProps {
  attendance: Attendance[];
  month: Date;
}

export function DetailedAttendanceCalendar({
  attendance,
  month,
}: DetailedAttendanceCalendarProps) {
  // Get all days in the month
  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  // Create calendar grid with empty cells for proper alignment
  const startWeekday = getDay(days[0]);
  const prefixDays = Array(startWeekday).fill(null);
  const calendarDays = [...prefixDays, ...days];

  // Create attendance lookup map
  const attendanceMap = new Map(
    attendance.map(a => [format(a.date, 'yyyy-MM-dd'), a])
  );

  return (
    <div className="rounded-md border">
      {/* Calendar Header */}
      <div className="grid grid-cols-7 gap-px border-b bg-muted text-center text-sm font-medium">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-muted">
        {calendarDays.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="bg-background p-3 h-32" />;
          }

          const dateKey = format(day, 'yyyy-MM-dd');
          const dayAttendance = attendanceMap.get(dateKey);

          return (
            <div
              key={dateKey}
              className={cn(
                "bg-background p-3 h-32",
                "hover:bg-muted/50 transition-colors",
                "relative"
              )}
            >
              <div className="flex flex-col h-full">
                {/* Date */}
                <span className="text-sm font-medium">
                  {format(day, 'd')}
                </span>

                {/* Attendance Status */}
                {dayAttendance ? (
                  <div className="mt-1 flex flex-col gap-1">
                    <div className={cn(
                      "text-xs font-medium rounded-full px-2 py-1 w-fit",
                      dayAttendance.isPresent 
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    )}>
                      {dayAttendance.isPresent ? "Present" : "Absent"}
                    </div>

                    {/* Branch Name */}
                    {dayAttendance.branch && (
                      <div className="text-xs text-muted-foreground">
                        {dayAttendance.branch.name}
                      </div>
                    )}

                    {/* Status Flags */}
                    <div className="flex gap-1 flex-wrap">
                      {dayAttendance.isHalfDay && (
                        <span className="bg-blue-100 text-blue-700 text-xs rounded-full px-2 py-0.5">
                          Half Day
                        </span>
                      )}
                      {dayAttendance.overtime && (
                        <span className="bg-purple-100 text-purple-700 text-xs rounded-full px-2 py-0.5">
                          Overtime
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground mt-1">
                    No record
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 
