import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAttendanceConflicts } from "@/lib/services/attendance-conflicts";
import { AttendanceConflictFilters } from "@/components/attendance/attendance-conflict-filters";
import {
  AttendanceConflictTable,
  SerializedAttendanceConflict,
} from "@/components/attendance/attendance-conflict-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PageProps {
  searchParams: Promise<{
    month?: string;
    year?: string;
  }>;
}

export default async function AttendanceConflictsPage({ searchParams }: PageProps) {
  const session = await auth();
  // @ts-expect-error - user role is not defined on the session type
  const role = session?.user?.role;

  if (!session || !["HR", "MANAGEMENT"].includes(role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const today = new Date();
  const month = params.month ? parseInt(params.month, 10) : today.getMonth() + 1;
  const year = params.year ? parseInt(params.year, 10) : today.getFullYear();

  const conflicts = await getAttendanceConflicts(month, year);

  const serializedConflicts: SerializedAttendanceConflict[] = conflicts.map((conflict) => ({
    ...conflict,
    entries: conflict.entries.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      verifiedAt: entry.verifiedAt ? entry.verifiedAt.toISOString() : null,
    })),
  }));

  const totalDuplicateEntries = serializedConflicts.reduce(
    (sum, conflict) => sum + conflict.entries.length,
    0
  );
  const affectedUsers = new Set(serializedConflicts.map((conflict) => conflict.userId)).size;

  return (
    <div className="flex-1 space-y-6 p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Attendance Conflicts</h1>
          <p className="text-sm text-muted-foreground">
            Review and resolve duplicate attendance entries before running payroll.
          </p>
        </div>
        <AttendanceConflictFilters month={month} year={year} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Conflict Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{serializedConflicts.length}</div>
            <p className="text-xs text-muted-foreground">With duplicates this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Impacted Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{affectedUsers}</div>
            <p className="text-xs text-muted-foreground">Require manual review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDuplicateEntries}</div>
            <p className="text-xs text-muted-foreground">Entries to inspect</p>
          </CardContent>
        </Card>
      </div>

      <AttendanceConflictTable conflicts={serializedConflicts} month={month} year={year} />
    </div>
  );
}

