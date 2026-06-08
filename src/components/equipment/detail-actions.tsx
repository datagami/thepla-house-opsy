"use client";

import { useState } from "react";
import Link from "next/link";
import { BellOff, Pencil, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SnoozeDialog } from "@/components/equipment/snooze-dialog";

interface DetailActionsProps {
  equipmentId: string;
  equipmentName?: string;
  canManage: boolean;
}

export function DetailActions({
  equipmentId,
  equipmentName,
  canManage,
}: DetailActionsProps) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  if (!canManage) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
        style={{
          background: "#f4f4f5",
          color: "#71717a",
          borderColor: "#e4e4e7",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Read-only
      </span>
    );
  }

  return (
    <>
      <div className="flex items-center gap-[9px]">
        <Button
          variant="outline"
          type="button"
          onClick={() => setSnoozeOpen(true)}
        >
          <BellOff size={15} className="mr-1.5" />
          Snooze
        </Button>

        <Button variant="outline" asChild>
          <Link href={`/equipment/${equipmentId}/edit`}>
            <Pencil size={15} className="mr-1.5" />
            Edit
          </Link>
        </Button>

        <Button asChild>
          <Link href={`/equipment/${equipmentId}/records/new`}>
            <Wrench size={15} className="mr-1.5" />
            Log Maintenance
          </Link>
        </Button>
      </div>

      <SnoozeDialog
        equipmentId={equipmentId}
        equipmentName={equipmentName}
        open={snoozeOpen}
        onOpenChange={setSnoozeOpen}
      />
    </>
  );
}
