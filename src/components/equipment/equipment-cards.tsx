"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, ChevronRight, BellOff, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryPill, StatusBadge } from "@/components/equipment/ui";
import { CategoryIcon } from "@/components/equipment/category-icon";
import { SnoozeDialog } from "@/components/equipment/snooze-dialog";
import { CATEGORY_META } from "@/lib/equipment-display";
import { getReminderState } from "@/lib/services/maintenance-schedule";
import type { EquipmentRow } from "@/components/equipment/equipment-table";

interface EquipmentCardsProps {
  rows: EquipmentRow[];
  canManage: boolean;
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
  onSnooze: (id: string) => void;
}

function ItemCard({ row, canManage, onSnooze }: ItemCardProps) {
  const router = useRouter();
  const today = new Date();
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

  return (
    <div
      className="rounded-xl border bg-card shadow-sm cursor-pointer"
      onClick={() => router.push(`/equipment/${row.id}`)}
    >
      {/* Top row: icon + name/category/outlet + chevron */}
      <div className="flex items-start gap-[11px] p-3.5">
        {/* Category icon tile */}
        <div
          className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[9px]"
          style={{ background: cm.bg, color: cm.fg }}
        >
          <CategoryIcon name={cm.icon} size={19} strokeWidth={2.1} />
        </div>

        {/* Name + pills */}
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-[650] leading-[1.3] text-foreground">
            {row.name}
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
        <StatusBadge state={reminderState} subLabel={snoozeSubLabel} size="sm" />

        {!canManage ? (
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
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-[12px]"
              onClick={() => onSnooze(row.id)}
            >
              <BellOff size={13} />
              Snooze
            </Button>
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
          </div>
        )}
      </div>
    </div>
  );
}

export function EquipmentCards({ rows, canManage }: EquipmentCardsProps) {
  const [snoozeId, setSnoozeId] = useState<string | null>(null);
  const snoozeRow = rows.find((r) => r.id === snoozeId);

  return (
    <>
      <div className="flex flex-col gap-2.5 p-3">
        {rows.map((row) => (
          <ItemCard
            key={row.id}
            row={row}
            canManage={canManage}
            onSnooze={setSnoozeId}
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
    </>
  );
}
