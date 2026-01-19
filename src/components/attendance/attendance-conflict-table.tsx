"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type SerializedAttendanceConflictEntry = {
  id: string;
  isPresent: boolean;
  isWeeklyOff?: boolean;
  isHalfDay: boolean;
  overtime: boolean;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  createdAt: string;
  updatedAt: string;
  verifiedAt: string | null;
  verifiedByName: string | null;
  verificationNote: string | null;
};

export type SerializedAttendanceConflict = {
  userId: string;
  userName: string | null;
  department: string | null;
  branchName: string | null;
  date: string;
  entries: SerializedAttendanceConflictEntry[];
};

interface AttendanceConflictTableProps {
  conflicts: SerializedAttendanceConflict[];
  month: number;
  year: number;
}

const DISPLAY_LOCALE =
  process.env.NEXT_PUBLIC_ATTENDANCE_LOCALE ?? "en-GB";
const DISPLAY_TIMEZONE =
  process.env.NEXT_PUBLIC_ATTENDANCE_TIMEZONE ?? "Asia/Kolkata";

const dayFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: DISPLAY_TIMEZONE,
});

const formatBadgeDate = (value: string) => {
  const date = new Date(value);
  const parts = dayFormatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${weekday}, ${day} ${month}`;
};

const dateTimeFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: DISPLAY_TIMEZONE,
});

const formatDateTime = (value: string) =>
  dateTimeFormatter.format(new Date(value));

export function AttendanceConflictTable({ conflicts }: AttendanceConflictTableProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedEntry = conflicts
    .flatMap((conflict) => conflict.entries)
    .find((entry) => entry.id === pendingId);

  const handleDelete = async () => {
    if (!pendingId) {
      return;
    }

    try {
      const response = await fetch(`/api/attendance/${pendingId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to delete attendance record");
      }

      toast.success("Attendance entry removed");
      setOpen(false);
      setPendingId(null);
      startTransition(() => router.refresh());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete attendance record";
      toast.error(message);
    }
  };

  if (conflicts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No attendance conflicts 🎉</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Every user currently has at most one attendance entry per day for this month.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {conflicts.map((conflict) => (
          <Card key={`${conflict.userId}-${conflict.date}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">
                  {conflict.userName ?? "Unknown user"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {conflict.department ? `${conflict.department} • ` : ""}
                  {conflict.branchName ?? "Unassigned branch"}
                </p>
              </div>
              <Badge variant="secondary">
                {formatBadgeDate(conflict.date)}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {conflict.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {entry.isWeeklyOff ? (
                        <Badge className="bg-purple-100 text-purple-800">Weekly Off</Badge>
                      ) : (
                        <Badge variant={entry.isPresent ? "default" : "outline"}>
                          {entry.isPresent ? "Present" : "Absent"}
                        </Badge>
                      )}
                      <Badge
                        variant={
                          entry.status === "APPROVED"
                            ? "default"
                            : entry.status === "REJECTED"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {entry.status.replace("_", " ")}
                      </Badge>
                      {entry.isHalfDay && <Badge variant="outline">Half Day</Badge>}
                      {entry.overtime && <Badge variant="outline">OT</Badge>}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground space-y-1">
                      <p>
                        Check-in/out:{" "}
                        {entry.checkIn || entry.checkOut
                          ? `${entry.checkIn ?? "--"} - ${entry.checkOut ?? "--"}`
                          : "Not captured"}
                      </p>
                      <p>Created at {formatDateTime(entry.createdAt)}</p>
                      {entry.verifiedAt && (
                        <p>
                          Verified by {entry.verifiedByName ?? "Unknown"} on{" "}
                          {formatDateTime(entry.verifiedAt)}
                        </p>
                      )}
                      {entry.verificationNote && (
                        <p className="italic">Note: {entry.verificationNote}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={conflict.entries.length <= 1 || isPending}
                      onClick={() => {
                        setPendingId(entry.id);
                        setOpen(true);
                      }}
                    >
                      Remove entry
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {conflict.entries.length} duplicates for this day
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this attendance entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedEntry
                ? `You are about to delete the ${
                    selectedEntry.isWeeklyOff
                      ? "weekly off"
                      : selectedEntry.isPresent
                        ? "present"
                        : "absent"
                  } entry recorded on ${new Date(
                    selectedEntry.createdAt
                  ).toLocaleString()}. This action cannot be undone.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setOpen(false);
                setPendingId(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/90")}
              onClick={handleDelete}
              disabled={isPending}
            >
              Delete entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

