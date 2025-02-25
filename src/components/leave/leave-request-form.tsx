"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const LEAVE_TYPES = [
  { value: "CASUAL", label: "Casual Leave" },
  { value: "SICK", label: "Sick Leave" },
  { value: "ANNUAL", label: "Annual Leave" },
  { value: "UNPAID", label: "Unpaid Leave" },
  { value: "OTHER", label: "Other" },
] as const;

interface LeaveRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LeaveRequestForm({ isOpen, onClose }: LeaveRequestFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leaveType, setLeaveType] = useState<string>("CASUAL");
  const [reason, setReason] = useState("");

  const handleSubmit = async () => {
    if (!startDate || !endDate || !leaveType || !reason) {
      toast.error("Please fill in all fields");
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
          startDate,
          endDate,
          leaveType,
          reason,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit leave request");
      }

      toast.success("Leave request submitted successfully");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error("Failed to submit leave request");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit Leave Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="leaveType">Leave Type</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger id="leaveType" className="mt-1">
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
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Submitting..." : "Submit Request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 