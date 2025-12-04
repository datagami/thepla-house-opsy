"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, 
  CalendarCheck, 
  Users, 
  DollarSign, 
  Shirt
} from "lucide-react";
import { AttendanceReports } from "./attendance-reports";
import { LeaveReports } from "./leave-reports";
import { EmployeeReports } from "./employee-reports";
import { FinancialReports } from "./financial-reports";
import { UniformReports } from "./uniform-reports";

interface ReportsDashboardProps {
  userRole: string;
  userId: string;
}

export function ReportsDashboard({ userRole, userId }: ReportsDashboardProps) {
  const [selectedReport, setSelectedReport] = useState<string>("attendance");

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reports & Analytics</h2>
          <p className="text-muted-foreground">
            Comprehensive insights into your organization's data
          </p>
        </div>
      </div>

      <Tabs value={selectedReport} onValueChange={setSelectedReport} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="leave" className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4" />
            Leave
          </TabsTrigger>
          <TabsTrigger value="employee" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Employee
          </TabsTrigger>
          <TabsTrigger value="financial" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Financial
          </TabsTrigger>
          <TabsTrigger value="uniform" className="flex items-center gap-2">
            <Shirt className="h-4 w-4" />
            Uniform
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4">
          <AttendanceReports userRole={userRole} userId={userId} />
        </TabsContent>

        <TabsContent value="leave" className="space-y-4">
          <LeaveReports userRole={userRole} userId={userId} />
        </TabsContent>

        <TabsContent value="employee" className="space-y-4">
          <EmployeeReports userRole={userRole} userId={userId} />
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <FinancialReports userRole={userRole} userId={userId} />
        </TabsContent>

        <TabsContent value="uniform" className="space-y-4">
          <UniformReports userRole={userRole} userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

