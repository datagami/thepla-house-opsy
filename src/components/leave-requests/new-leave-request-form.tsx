"use client";

import { useEffect, useRef, useState } from "react";
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
import { Calendar as CalendarIcon, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Minimal Web Speech API type — declared inline because lib.dom doesn't
// expose `webkitSpeechRecognition` and adding it to a global .d.ts file
// would be overkill for a single form. Only the bits we use are typed.
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((this: SpeechRecognitionLike, ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((this: SpeechRecognitionLike, ev: { error: string }) => void) | null;
  onend: ((this: SpeechRecognitionLike) => void) | null;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: {
      isFinal: boolean;
      [i: number]: { transcript: string };
    };
  };
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const VOICE_LANGS = [
  { value: "en-IN", label: "English" },
  { value: "hi-IN", label: "हिन्दी" },
];

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

  // Switching the leave type to ANNUAL while a too-soon start date is
  // already chosen leaves the trigger button showing an invalid date until
  // the user reopens the calendar (which would disable it). Proactively
  // clear stale dates so the form doesn't lie about what's selectable.
  useEffect(() => {
    if (leaveType !== "ANNUAL") return;
    const minStart = addDays(startOfDay(new Date()), ANNUAL_LEAVE_MIN_ADVANCE_DAYS);
    if (startDate && startOfDay(startDate) < minStart) {
      setStartDate(undefined);
      setEndDate(undefined);
    }
  }, [leaveType, startDate]);

  // Voice-to-text for the Reason field. Uses the browser's Web Speech API
  // (free, no backend) — works in Chrome/Edge/Safari. The mic button is
  // hidden entirely on unsupported browsers.
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState<string>("en-IN");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Snapshot the reason text at the moment recording started; we append
  // recognised transcript to this base so interim results don't pile up
  // on top of each other.
  const reasonBaseRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition;
    if (Ctor) setVoiceSupported(true);
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const startListening = () => {
    const Ctor =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
        .webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Voice input isn't supported on this browser. Please type the reason.");
      return;
    }
    try {
      const recog = new Ctor();
      recog.lang = voiceLang;
      recog.interimResults = true;
      recog.continuous = true;
      reasonBaseRef.current = reason ? reason.replace(/\s+$/, "") + " " : "";
      recog.onresult = (event) => {
        let interim = "";
        let finalChunk = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          // Spec allows zero alternatives in a SpeechRecognitionResult;
          // skip rather than crash on transcript-of-undefined.
          const transcript = result[0]?.transcript;
          if (!transcript) continue;
          if (result.isFinal) finalChunk += transcript;
          else interim += transcript;
        }
        if (finalChunk) {
          reasonBaseRef.current = reasonBaseRef.current + finalChunk + " ";
        }
        setReason(reasonBaseRef.current + interim);
      };
      recog.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          toast.error("Microphone permission denied. Allow mic access and try again.");
        } else if (event.error !== "aborted" && event.error !== "no-speech") {
          toast.error(`Voice input error: ${event.error}`);
        }
        setListening(false);
      };
      recog.onend = () => {
        setListening(false);
      };
      recognitionRef.current = recog;
      recog.start();
      setListening(true);
    } catch (err) {
      console.error(err);
      toast.error("Could not start voice input. Please try again or type the reason.");
      setListening(false);
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

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
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Reason</label>
              {voiceSupported && (
                <div className="flex items-center gap-2">
                  <Select value={voiceLang} onValueChange={setVoiceLang} disabled={listening}>
                    <SelectTrigger className="h-8 w-[120px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_LANGS.map((l) => (
                        <SelectItem key={l.value} value={l.value} className="text-xs">
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant={listening ? "destructive" : "outline"}
                    onClick={listening ? stopListening : startListening}
                    title={listening ? "Stop recording" : "Speak the reason instead of typing"}
                    className="gap-1.5"
                  >
                    {listening ? (
                      <>
                        <Square className="h-4 w-4" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4" />
                        Speak
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                voiceSupported
                  ? "Type, or tap Speak and dictate the reason"
                  : "Please provide a detailed reason for your leave request"
              }
              className="min-h-[100px]"
            />
            {listening && (
              <p className="text-xs text-red-600 flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                Listening… tap Stop when you&apos;re done.
              </p>
            )}
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