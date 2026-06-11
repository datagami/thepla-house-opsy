"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BellOff, Pencil, Wrench, Archive, ArchiveRestore, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SnoozeDialog } from "@/components/equipment/snooze-dialog";
import { ArchiveDialog } from "@/components/equipment/archive-dialog";
import { setEquipmentStatus } from "@/lib/equipment-actions";

interface DetailActionsProps {
  equipmentId: string;
  equipmentName?: string;
  canManage: boolean;
  canSnooze?: boolean;
  canLog?: boolean;
  status: "ACTIVE" | "RETIRED";
  hasImage?: boolean;
}

export function DetailActions({
  equipmentId,
  equipmentName,
  canManage,
  canSnooze = false,
  canLog = false,
  status,
  hasImage = false,
}: DetailActionsProps) {
  const router = useRouter();
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const isRetired = status === "RETIRED";

  if (!canManage && !canSnooze && !canLog) {
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
      <div className="flex flex-wrap items-center gap-[9px]">
        {canSnooze && (
          <Button
            variant="outline"
            type="button"
            onClick={() => setSnoozeOpen(true)}
          >
            <BellOff size={15} className="mr-1.5" />
            Snooze
          </Button>
        )}

        {canManage && (
          <Button variant="outline" asChild>
            <Link href={`/equipment/${equipmentId}/edit`}>
              <Pencil size={15} className="mr-1.5" />
              Edit
            </Link>
          </Button>
        )}

        {canManage && (
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/equipment/labels?ids=${equipmentId}`} target="_blank" rel="noopener noreferrer">
              <Printer size={15} className="mr-1.5" />
              Print label
            </a>
          </Button>
        )}

        {canManage && (
        <Button
          variant="outline"
          type="button"
          onClick={async () => {
            if (!isRetired) {
              setArchiveOpen(true);
              return;
            }
            try {
              await setEquipmentStatus(equipmentId, "ACTIVE");
              toast.success("Item marked active");
              router.refresh();
            } catch (err) {
              toast.error(
                err instanceof Error
                  ? err.message
                  : "Failed to update item status"
              );
            }
          }}
        >
          {isRetired ? (
            <>
              <ArchiveRestore size={15} className="mr-1.5" />
              Mark active
            </>
          ) : (
            <>
              <Archive size={15} className="mr-1.5" />
              Mark inactive
            </>
          )}
        </Button>
        )}

        {canLog && (
          <Button asChild>
            <Link href={`/equipment/${equipmentId}/records/new`}>
              <Wrench size={15} className="mr-1.5" />
              Log Maintenance
            </Link>
          </Button>
        )}
      </div>

      <SnoozeDialog
        equipmentId={equipmentId}
        equipmentName={equipmentName}
        open={snoozeOpen}
        onOpenChange={setSnoozeOpen}
      />

      <ArchiveDialog
        equipmentId={equipmentId}
        equipmentName={equipmentName ?? "this item"}
        hasImage={hasImage}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
      />
    </>
  );
}
