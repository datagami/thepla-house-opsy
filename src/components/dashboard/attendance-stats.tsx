"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileClock } from "lucide-react";
import { useRouter } from "next/navigation";

interface AttendanceStatsProps {
  pendingCount: number;
}

export function AttendanceStats({ pendingCount }: AttendanceStatsProps) {
  const router = useRouter();

  return (
    <Card 
      className="cursor-pointer hover:bg-accent/5" 
      onClick={() => router.push("/attendance")}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Pending Attendance
        </CardTitle>
        <FileClock className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {pendingCount}
        </div>
        <p className="text-xs text-muted-foreground">
          employees need to mark attendance today
        </p>
      </CardContent>
    </Card>
  );
} 
