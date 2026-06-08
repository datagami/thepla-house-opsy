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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { format, differenceInDays, addDays } from "date-fns";
import { Calendar as CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const LEAVE_TYPES = [
  { value: "CASUAL", label: "Casual Leave" },
  { value: "SICK", label: "Sick Leave" },
  { value: "ANNUAL", label: "Annual Leave" },
  { value: "UNPAID", label: "Unpaid Leave" },
];

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
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const selectedEmployee =
    employeeId && employeeId !== "SELF"
      ? employees.find((e) => e.id === employeeId)
      : null;

  const handleSubmit = async () => {
    if (!startDate || !endDate || !leaveType || !reason) {
      toast.error("Please fill in all fields");
      return;
    }

    if (differenceInDays(endDate, startDate) < 0) {
      toast.error("End date cannot be before start date");
      return;
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
              {userRole === "BRANCH_MANAGER" ? (
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SELF">Myself</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {(e.name ?? "Unnamed")}
                        {e.departmentName ? ` (${e.departmentName})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                // HR / MANAGEMENT — searchable combobox; list spans all branches.
                <Popover
                  open={employeePickerOpen}
                  onOpenChange={setEmployeePickerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={employeePickerOpen}
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate">
                        {employeeId === "SELF"
                          ? "Myself"
                          : selectedEmployee
                            ? `${selectedEmployee.name ?? "Unnamed"}${
                                selectedEmployee.branchName
                                  ? ` · ${selectedEmployee.branchName}`
                                  : ""
                              }`
                            : "Select employee"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search by name, branch, or department…" />
                      <CommandList>
                        <CommandEmpty>No employee found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="myself"
                            onSelect={() => {
                              setEmployeeId("SELF");
                              setEmployeePickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                employeeId === "SELF" ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Myself
                          </CommandItem>
                          {employees.map((e) => {
                            const label = [
                              e.name ?? "Unnamed",
                              e.branchName,
                              e.departmentName,
                            ]
                              .filter(Boolean)
                              .join(" · ");
                            return (
                              <CommandItem
                                key={e.id}
                                value={label}
                                onSelect={() => {
                                  setEmployeeId(e.id);
                                  setEmployeePickerOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    employeeId === e.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{e.name ?? "Unnamed"}</span>
                                  {(e.branchName || e.departmentName) && (
                                    <span className="text-xs text-muted-foreground">
                                      {[e.branchName, e.departmentName].filter(Boolean).join(" · ")}
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
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
                    disabled={(date) => 
                      date < new Date(new Date().setHours(0, 0, 0, 0))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
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