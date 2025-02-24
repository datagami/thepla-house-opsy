"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileClock, UserCheck, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";

interface HRStats {
  pendingManagerAttendance: number;
  pendingVerifications: number;
  pendingApprovals: number;
}

interface DashboardStatsProps {
  stats: HRStats;
  userRole: string;
}

export function DashboardStats({ stats, userRole }: DashboardStatsProps) {
  const router = useRouter();

  if (userRole === "HR") {
    return (
      <>
        <Card 
          className="cursor-pointer hover:bg-accent/5"
          onClick={() => router.push("/hr/attendance")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Manager Attendance
            </CardTitle>
            <FileClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.pendingManagerAttendance}
            </div>
            <p className="text-xs text-muted-foreground">
              pending for today
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent/5"
          onClick={() => router.push("/hr/attendance-verification")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Attendance Verifications
            </CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.pendingVerifications}
            </div>
            <p className="text-xs text-muted-foreground">
              need verification
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent/5"
          onClick={() => router.push("/users")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              User Approvals
            </CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.pendingApprovals}
            </div>
            <p className="text-xs text-muted-foreground">
              waiting approval
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  return null;
} 