"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, differenceInDays, addDays, startOfDay } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const LEAVE_TYPES = [
  { value: "EMERGENCY", label: "Emergency Leave" },
  { value: "ANNUAL", label: "Annual Leave" },
];

// Annual leave must be filed at least this many calendar days before the
// start date — gives the team time to plan cover. Emergency leave has no
// advance-notice requirement (that's the point of it).
const ANNUAL_LEAVE_MIN_ADVANCE_DAYS = 15;

type EmployeeOption = {
  id: string;
  name: string | null;
  departmentName: string | null;
  branchName?: string | null;
};

const canFileForOthers = (role: string) =>
  role === "BRANCH_MANAGER" || role === "HR" || role === "MANAGEMENT";

export function NewLeaveRequestForm({
  userRole,
  employees = [],
}: {
  userRole: string;
  employees?: EmployeeOption[];
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [leaveType, setLeaveType] = useState<string>();
  const [reason, setReason] = useState("");
  const [employeeId, setEmployeeId] = useState<string>(() =>
    canFileForOthers(userRole) ? "SELF" : ""
  );

  const handleSubmit = async () => {
    if (!startDate || !endDate || !leaveType || !reason) {
      toast.error("Please fill in all fields");
      return;
    }

    if (differenceInDays(endDate, startDate) < 0) {
      toast.error("End date cannot be before start date");
      return;
    }

    if (leaveType === "ANNUAL") {
      const advance = differenceInDays(startOfDay(startDate), startOfDay(new Date()));
      if (advance < ANNUAL_LEAVE_MIN_ADVANCE_DAYS) {
        toast.error(
          `Annual leave must be applied at least ${ANNUAL_LEAVE_MIN_ADVANCE_DAYS} days before the start date. For shorter notice, please use Emergency Leave.`
        );
        return;
      }
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/leave-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(canFileForOthers(userRole) && employeeId && employeeId !== "SELF"
            ? { userId: employeeId }
            : {}),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          leaveType,
          reason,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || "Failed to submit leave request");
      }

      toast.success(
        canFileForOthers(userRole) && employeeId && employeeId !== "SELF"
          ? "Leave request submitted for review"
          : "Leave request submitted successfully"
      );
      router.push("/leave-requests");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit leave request");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {canFileForOthers(userRole)
            ? "Create Leave Request"
            : "Submit Leave Request"}
        </CardTitle>
        <CardDescription>
          {userRole === "BRANCH_MANAGER"
            ? "Submit a leave request for yourself or an employee in your branch"
            : userRole === "HR" || userRole === "MANAGEMENT"
              ? "Submit a leave request for yourself or on behalf of any active employee"
              : "Fill in the details below to submit your leave request"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {canFileForOthers(userRole) && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Employee</label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SELF">Myself</SelectItem>
                  {employees.map((e) => {
                    const meta = [e.branchName, e.departmentName]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <SelectItem key={e.id} value={e.id}>
                        {(e.name ?? "Unnamed")}
                        {meta ? ` (${meta})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Leave Type</label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger>
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      if (date && (!endDate || date > endDate)) {
                        setEndDate(addDays(date, 1));
                      }
                    }}
                    disabled={(date) => {
                      const today = startOfDay(new Date());
                      // Annual leave must start at least N days from today.
                      // For Emergency leave (and any other type), today is fine.
                      const minStart =
                        leaveType === "ANNUAL"
                          ? addDays(today, ANNUAL_LEAVE_MIN_ADVANCE_DAYS)
                          : today;
                      return date < minStart;
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {leaveType === "ANNUAL" && (
                <p className="text-xs text-muted-foreground">
                  Annual leave must be applied at least {ANNUAL_LEAVE_MIN_ADVANCE_DAYS} days
                  before the start date.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => 
                      date < (startDate || new Date(new Date().setHours(0, 0, 0, 0)))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Reason</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a detailed reason for your leave request"
              className="min-h-[100px]"
            />
          </div>

          <div className="flex justify-end space-x-4">
            <Button
              variant="outline"
              onClick={() => router.push("/leave-requests")}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading
                ? "Submitting..."
                : canFileForOthers(userRole) && employeeId && employeeId !== "SELF"
                  ? "Submit for Review"
                  : "Submit Request"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 