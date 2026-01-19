import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SelfAttendanceFormWrapper } from "@/components/attendance/self-attendance-form-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CalendarCheck, AlertCircle } from "lucide-react";
import {Attendance} from "@/models/models";
import { getShiftDisplay } from "@/lib/utils/shift-display";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SelfAttendanceDatePicker } from "@/components/attendance/self-attendance-date-picker";

export const metadata: Metadata = {
  title: "My Attendance - HRMS",
  description: "View and mark your attendance",
};

interface Props {
  searchParams: Promise<{
    date?: string;
  }>;
}

export default async function SelfAttendancePage({ searchParams }: Props) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user as {
    id: string;
    name: string;
    role: string;
  };

  if (!user.role || !user.id || !user.name) {
    redirect("/login");
  }

  // Only allow HR, MANAGEMENT, SELF_ATTENDANCE, and BRANCH_MANAGER roles
  if (!["HR", "MANAGEMENT", "SELF_ATTENDANCE", "BRANCH_MANAGER"].includes(user.role)) {
    redirect("/dashboard");
  }

  const searchParamDate = (await searchParams).date;
  const selectedDate = searchParamDate ? new Date(searchParamDate) : new Date();
  selectedDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = selectedDate.toISOString() === today.toISOString();

  // Get user's attendance for the selected date
  const attendance = await prisma.attendance.findFirst({
    where: {
      userId: user.id,
      date: selectedDate,
    },
    include: {
      verifiedBy: {
        select: {
          name: true,
        },
      },
    },
  }) as Attendance & { verifiedBy?: { name: string } | null };

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">My Attendance</h2>
        <SelfAttendanceDatePicker date={selectedDate} />
      </div>

      {attendance?.status === "REJECTED" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Attendance Rejected</AlertTitle>
          <AlertDescription>
            Your attendance for {selectedDate.toLocaleDateString()} has been rejected.
            {attendance.verificationNote && (
              <div className="mt-2">
                <strong>Reason:</strong> {attendance.verificationNote}
              </div>
            )}
            {attendance.verifiedBy && (
              <div className="mt-1 text-sm">
                Rejected by: {attendance.verifiedBy.name}
              </div>
            )}
            {attendance.verifiedAt && (
              <div className="mt-1 text-sm">
                Rejected on: {attendance.verifiedAt.toLocaleString()}
              </div>
            )}
            <div className="mt-2 font-semibold">
              You can update and resubmit your attendance below.
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance Status</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {attendance ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold">
                    {attendance.isWeeklyOff
                      ? "Weekly Off"
                      : attendance.isPresent
                        ? "Present"
                        : "Absent"}
                    {!attendance.isWeeklyOff && attendance.isHalfDay && " (Half Day)"}
                  </div>
                  {attendance.status && (
                    <Badge 
                      className={
                        attendance.status === "APPROVED" 
                          ? "bg-emerald-100 text-emerald-800"
                          : attendance.status === "REJECTED"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {attendance.status === "APPROVED" 
                        ? "Approved" 
                        : attendance.status === "REJECTED"
                        ? "Rejected"
                        : "Pending Verification"}
                    </Badge>
                  )}
                </div>
                {attendance.checkIn && !attendance.isWeeklyOff && (
                  <p className="text-sm text-muted-foreground">
                    Check In: {attendance.checkIn}
                  </p>
                )}
                {attendance.checkOut && !attendance.isWeeklyOff && (
                  <p className="text-sm text-muted-foreground">
                    Check Out: {attendance.checkOut}
                  </p>
                )}
                {attendance.verifiedAt && attendance.status === "APPROVED" && (
                  <p className="text-sm text-muted-foreground">
                    Verified At: {attendance.verifiedAt.toLocaleString()}
                  </p>
                )}
                {attendance.isPresent && !attendance.isWeeklyOff && (
                  <p className="text-sm text-muted-foreground">
                    Shifts: {getShiftDisplay(attendance.shift1, attendance.shift2, attendance.shift3)}
                  </p>
                )}
                {attendance.isHalfDay && (
                  <p className="text-sm text-muted-foreground">
                    Half Day: {attendance.isHalfDay ? 'Yes' : 'No'}
                  </p>
                )}
                {attendance.overtime && (
                  <p className="text-sm text-muted-foreground">
                    Overtime: {attendance.overtime ? 'Yes' : 'No'}
                  </p>
                )}
                {attendance.notes && (
                  <p className="text-sm text-muted-foreground">
                    Notes: {attendance.notes}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">
                Not Marked
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {attendance?.status === "REJECTED" ? "Resubmit Attendance" : isToday ? "Mark Attendance" : "Update Attendance"}
            </CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {attendance?.status === "REJECTED" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Your attendance was rejected. Please review and update the details, then resubmit for HR approval.
                </p>
                <SelfAttendanceFormWrapper
                  userId={user.id}
                  userName={user.name}
                  userRole={user.role}
                  date={selectedDate}
                  department={user.role}
                  currentAttendance={attendance}
                />
              </div>
            ) : isToday ? (
              <SelfAttendanceFormWrapper
                userId={user.id}
                userName={user.name}
                userRole={user.role}
                date={selectedDate}
                department={user.role}
                currentAttendance={attendance}
              />
            ) : attendance ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  You can update your attendance for this date.
                </p>
                <SelfAttendanceFormWrapper
                  userId={user.id}
                  userName={user.name}
                  userRole={user.role}
                  date={selectedDate}
                  department={user.role}
                  currentAttendance={attendance}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Attendance can only be marked for today.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
