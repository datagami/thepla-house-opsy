import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SelfAttendanceFormWrapper } from "@/components/attendance/self-attendance-form-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CalendarCheck } from "lucide-react";
import {Attendance} from "@/models/models";

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

  // Only allow HR, MANAGEMENT, and SELF_ATTENDANCE roles
  if (!["HR", "MANAGEMENT", "SELF_ATTENDANCE"].includes(user.role)) {
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
    select: {
      id: true,
      isPresent: true,
      checkIn: true,
      checkOut: true,
      isHalfDay: true,
      status: true,
      verifiedAt: true,
      verifiedBy: {
        select: {
          name: true,
        },
      },
    },
  }) as Attendance;

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">My Attendance</h2>
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {selectedDate.toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&#39;s Status</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {attendance ? (
              <div className="space-y-2">
                <div className="text-2xl font-bold">
                  {attendance.isPresent ? "Present" : "Absent"}
                  {attendance.isHalfDay && " (Half Day)"}
                </div>
                {attendance.checkIn && (
                  <p className="text-sm text-muted-foreground">
                    Check In: {attendance.checkIn}
                  </p>
                )}
                {attendance.checkOut && (
                  <p className="text-sm text-muted-foreground">
                    Check Out: {attendance.checkOut}
                  </p>
                )}
                {attendance.verifiedAt && (
                  <p className="text-sm text-muted-foreground">
                    Verified by: {attendance.verifiedBy?.name}
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

        {isToday && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mark Attendance</CardTitle>
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <SelfAttendanceFormWrapper
                userId={user.id}
                userName={user.name}
                userRole={user.role}
                date={selectedDate}
                currentAttendance={attendance}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
