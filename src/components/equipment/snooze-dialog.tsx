"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDays } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { BellOff, Info } from "lucide-react";

interface SnoozeDialogProps {
  equipmentId: string;
  equipmentName?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

type SnoozeMode = 7 | 14 | 0; // 0 = custom date

export function SnoozeDialog({
  equipmentId,
  equipmentName,
  open,
  onOpenChange,
}: SnoozeDialogProps) {
  const router = useRouter();
  const [mode, setMode] = useState<SnoozeMode>(7);
  const [customDate, setCustomDate] = useState("");
  const [loading, setLoading] = useState(false);

  function computeDate(): string {
    if (mode === 0) return customDate;
    return addDays(new Date(), mode).toISOString().slice(0, 10);
  }

  function formatShortDate(iso: string): string {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  }

  async function handleSnooze(snoozedUntil: string | null) {
    setLoading(true);
    try {
      const res = await fetch(`/api/equipment/${equipmentId}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snoozedUntil }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to update snooze");
        return;
      }
      toast.success(
        snoozedUntil
          ? `Reminders paused until ${formatShortDate(snoozedUntil)}`
          : "Snooze cleared"
      );
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit() {
    const date = computeDate();
    if (!date) {
      toast.error("Pick a date first");
      return;
    }
    handleSnooze(date);
  }

  const snoozeDate = computeDate();

  const opt = (days: SnoozeMode, label: string) => {
    const previewDate =
      days === 0
        ? null
        : addDays(new Date(), days).toISOString().slice(0, 10);
    const isSelected = mode === days;
    return (
      <button
        key={days}
        type="button"
        onClick={() => setMode(days)}
        className="w-full rounded-lg border p-3 text-left transition-[border-color,box-shadow] [transition-duration:140ms] cursor-pointer flex items-center gap-3"
        style={{
          borderColor: isSelected ? "hsl(var(--primary))" : "hsl(var(--border))",
          boxShadow: isSelected
            ? "0 0 0 3px hsl(var(--primary) / 0.12)"
            : "0 1px 2px 0 rgba(24,24,27,.04)",
          background: "hsl(var(--card))",
        }}
      >
        <div
          className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-sm font-bold"
          style={{ background: "hsl(var(--muted))", color: "hsl(var(--foreground))" }}
        >
          {days === 0 ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          ) : (
            `+${days}`
          )}
        </div>
        <div className="flex-1">
          <div className="text-[13.5px] font-semibold text-foreground">{label}</div>
          <div className="mt-[2px] text-[12px] text-muted-foreground">
            {previewDate ? `Until ${formatShortDate(previewDate)}` : "Choose a specific date"}
          </div>
        </div>
        {isSelected && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        )}
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Snooze reminders</DialogTitle>
          {equipmentName && (
            <DialogDescription>{equipmentName}</DialogDescription>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-2.5 py-1">
          {opt(7, "Snooze 1 week")}
          {opt(14, "Snooze 2 weeks")}
          {opt(0, "Pick a date")}

          {mode === 0 && (
            <div className="pt-1">
              <Label htmlFor="snooze-date" className="sr-only">
                Snooze until date
              </Label>
              <Input
                id="snooze-date"
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
          )}

          <div
            className="flex gap-2.5 rounded-lg border p-3 mt-1"
            style={{
              background: "hsl(var(--muted))",
              borderColor: "hsl(var(--border))",
            }}
          >
            <Info
              size={15}
              className="flex-none mt-[1px] text-muted-foreground"
            />
            <p className="text-[12px] leading-[1.5] text-muted-foreground">
              Snoozing pauses{" "}
              <strong className="font-semibold text-foreground">
                reminder emails
              </strong>{" "}
              for this item until the chosen date. It stays visible in the list
              as{" "}
              <strong className="font-semibold text-foreground">Snoozed</strong>
              .
            </p>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2.5 justify-between sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => handleSnooze(null)}
            disabled={loading}
            className="text-muted-foreground"
          >
            Clear snooze
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading || (mode === 0 && !customDate)}
            >
              <BellOff size={15} className="mr-1.5" />
              {snoozeDate
                ? `Snooze until ${formatShortDate(snoozeDate)}`
                : "Snooze"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
