"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, ChevronRight, BellOff, Wrench, MoreVertical, Archive, ArchiveRestore, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setEquipmentStatus } from "@/lib/equipment-actions";
import { CategoryPill, StatusBadge } from "@/components/equipment/ui";
import { CategoryIcon } from "@/components/equipment/category-icon";
import { SnoozeDialog } from "@/components/equipment/snooze-dialog";
import { ArchiveDialog } from "@/components/equipment/archive-dialog";
import { CATEGORY_META } from "@/lib/equipment-display";
import { getReminderState, daysUntil } from "@/lib/services/maintenance-schedule";
import type { EquipmentRow } from "@/components/equipment/equipment-table";

interface EquipmentCardsProps {
  rows: EquipmentRow[];
  canManage: boolean;
  canSnooze?: boolean;
  canLog?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface ItemCardProps {
  row: EquipmentRow;
  canManage: boolean;
  canSnooze: boolean;
  canLog: boolean;
  onSnooze: (id: string) => void;
  onArchive: (id: string) => void;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
}

function ItemCard({ row, canManage, canSnooze, canLog, onSnooze, onArchive, selected, onToggle }: ItemCardProps) {
  const router = useRouter();
  const today = new Date();
  const isRetired = row.status === "RETIRED";
  const reminderState = getReminderState(
    {
      nextDueDate: row.nextDueDate ? new Date(row.nextDueDate) : null,
      reminderLeadDays: row.reminderLeadDays,
      snoozedUntil: row.snoozedUntil ? new Date(row.snoozedUntil) : null,
      status: row.status,
    },
    today
  );

  const snoozeSubLabel =
    row.snoozedUntil && reminderState === "SNOOZED"
      ? `→ ${formatShortDate(row.snoozedUntil)}`
      : undefined;

  const cm = CATEGORY_META[row.category] ?? CATEGORY_META["OTHER"];
  const hasAnyAction = canManage || canSnooze || canLog;

  return (
    <div
      className={`rounded-xl border bg-card shadow-sm cursor-pointer${isRetired ? " opacity-60" : ""}`}
      onClick={() => router.push(`/equipment/${row.id}`)}
    >
      {/* Top row: icon + name/category/outlet + chevron */}
      <div className="flex items-start gap-[11px] p-3.5">
        {/* Selection checkbox (manage-gated) */}
        {canManage && onToggle && (
          <div
            className="mt-[2px] flex-none"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selected?.has(row.id) ?? false}
              onCheckedChange={() => onToggle(row.id)}
              aria-label="Select item"
            />
          </div>
        )}
        {/* Category icon tile or asset photo */}
        {row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.imageUrl} alt="" className="h-8 w-8 flex-none rounded object-cover" />
        ) : (
          <div
            className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[9px]"
            style={{ background: cm.bg, color: cm.fg }}
          >
            <CategoryIcon name={cm.icon} size={19} strokeWidth={2.1} />
          </div>
        )}

        {/* Name + pills */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-[7px] leading-[1.3]">
            <span className="text-[14px] font-[650] text-foreground">
              {row.name}
            </span>
            {isRetired && (
              <Badge variant="secondary" className="text-[11px] text-muted-foreground">
                Inactive
              </Badge>
            )}
          </div>
          <div className="mt-[5px] flex flex-wrap items-center gap-[7px]">
            <CategoryPill category={row.category} size="sm" />
            <span className="inline-flex items-center gap-[3px] text-[11.5px] text-muted-foreground">
              <MapPin size={12} className="flex-none" />
              {row.branch.name}
            </span>
          </div>
        </div>

        {/* Chevron */}
        <ChevronRight
          size={17}
          className="mt-[2px] flex-none text-muted-foreground/50"
        />
      </div>

      {/* Bottom row: status badge + actions */}
      <div className="flex items-center justify-between gap-2.5 border-t px-3.5 py-2.5">
        <StatusBadge state={reminderState} subLabel={snoozeSubLabel} size="sm" dueInDays={row.nextDueDate ? daysUntil(new Date(row.nextDueDate), today) : null} />

        {!hasAnyAction ? (
          <Badge
            variant="secondary"
            className="text-[11px] text-muted-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            Read-only
          </Badge>
        ) : (
          <div
            className="flex items-center gap-[7px]"
            onClick={(e) => e.stopPropagation()}
          >
            {canSnooze && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-[12px]"
                onClick={() => onSnooze(row.id)}
              >
                <BellOff size={13} />
                Snooze
              </Button>
            )}
            {canLog && (
              <Button
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-[12px]"
                asChild
              >
                <Link href={`/equipment/${row.id}/records/new`}>
                  <Wrench size={13} />
                  Log
                </Link>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="More actions"
                >
                  <MoreVertical size={15} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/equipment/${row.id}`}>Open detail</Link>
                </DropdownMenuItem>
                {canManage && (
                <>
                <DropdownMenuItem asChild>
                  <Link href={`/equipment/${row.id}/edit`}>Edit item</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/api/equipment/labels?ids=${row.id}`} target="_blank" rel="noopener noreferrer">
                    <Printer size={14} className="mr-2 text-muted-foreground" />
                    Print label
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={async () => {
                    if (row.status === "ACTIVE") {
                      onArchive(row.id);
                      return;
                    }
                    try {
                      await setEquipmentStatus(row.id, "ACTIVE");
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
                  {row.status === "ACTIVE" ? (
                    <>
                      <Archive size={14} className="mr-2 text-muted-foreground" />
                      Mark inactive
                    </>
                  ) : (
                    <>
                      <ArchiveRestore size={14} className="mr-2 text-muted-foreground" />
                      Mark active
                    </>
                  )}
                </DropdownMenuItem>
                </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
}

export function EquipmentCards({
  rows,
  canManage,
  canSnooze = false,
  canLog = false,
  selected,
  onToggle,
}: EquipmentCardsProps) {
  const [snoozeId, setSnoozeId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const snoozeRow = rows.find((r) => r.id === snoozeId);
  const archiveRow = rows.find((r) => r.id === archiveId);

  return (
    <>
      <div className="flex flex-col gap-2.5 p-3">
        {rows.map((row) => (
          <ItemCard
            key={row.id}
            row={row}
            canManage={canManage}
            canSnooze={canSnooze}
            canLog={canLog}
            onSnooze={setSnoozeId}
            onArchive={setArchiveId}
            selected={selected}
            onToggle={onToggle}
          />
        ))}
      </div>

      {snoozeId && (
        <SnoozeDialog
          equipmentId={snoozeId}
          equipmentName={snoozeRow?.name}
          open={!!snoozeId}
          onOpenChange={(o) => {
            if (!o) setSnoozeId(null);
          }}
        />
      )}

      {archiveId && (
        <ArchiveDialog
          equipmentId={archiveId}
          equipmentName={archiveRow?.name ?? "this item"}
          hasImage={archiveRow?.imageUrl != null}
          open={!!archiveId}
          onOpenChange={(o) => {
            if (!o) setArchiveId(null);
          }}
        />
      )}
    </>
  );
}
