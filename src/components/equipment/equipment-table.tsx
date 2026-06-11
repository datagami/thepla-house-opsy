"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, MoreHorizontal, Archive, ArchiveRestore, Printer } from "lucide-react";
import { toast } from "sonner";
import { setEquipmentStatus } from "@/lib/equipment-actions";
import { EquipmentCards } from "@/components/equipment/equipment-cards";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryPill, StatusBadge } from "@/components/equipment/ui";
import { SnoozeDialog } from "@/components/equipment/snooze-dialog";
import { ArchiveDialog } from "@/components/equipment/archive-dialog";
import { getReminderState, daysUntil } from "@/lib/services/maintenance-schedule";

export interface EquipmentRow {
  id: string;
  name: string;
  category: string;
  location: string | null;
  status: "ACTIVE" | "RETIRED";
  reminderLeadDays: number;
  frequencyMonths: number | null;
  nextDueDate: string | null;
  lastServiceDate: string | null;
  snoozedUntil: string | null;
  branch: { id: string; name: string };
  imageUrl: string | null;
}

interface EquipmentTableProps {
  rows: EquipmentRow[];
  canManage: boolean;
  canSnooze?: boolean;
  canLog?: boolean;
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

export function EquipmentTable({
  rows,
  canManage,
  canSnooze = false,
  canLog = false,
}: EquipmentTableProps) {
  const router = useRouter();
  const [snoozeId, setSnoozeId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);

  const today = new Date();
  const snoozeRow = rows.find((r) => r.id === snoozeId);
  const archiveRow = rows.find((r) => r.id === archiveId);
  const hasAnyAction = canManage || canSnooze || canLog;

  return (
    <>
      {/* Mobile: card list */}
      <div className="md:hidden">
        <EquipmentCards
          rows={rows}
          canManage={canManage}
          canSnooze={canSnooze}
          canLog={canLog}
        />
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Outlet</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Last serviced</TableHead>
            <TableHead>Next due</TableHead>
            <TableHead className="w-11" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
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

            const isRetired = row.status === "RETIRED";

            return (
              <TableRow
                key={row.id}
                className={`cursor-pointer hover:bg-muted/50${isRetired ? " opacity-60" : ""}`}
                onClick={() => router.push(`/equipment/${row.id}`)}
              >
                {/* Item */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    {row.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.imageUrl} alt="" className="h-8 w-8 flex-none rounded object-cover" />
                    ) : null}
                    <span className="font-semibold text-foreground">{row.name}</span>
                    {isRetired && (
                      <Badge variant="secondary" className="text-[11px] text-muted-foreground">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <div className="mt-[2px] text-[11.5px] text-muted-foreground">
                    {row.frequencyMonths
                      ? `Every ${row.frequencyMonths} months`
                      : "One-off"}
                  </div>
                </TableCell>

                {/* Category */}
                <TableCell>
                  <CategoryPill category={row.category} size="sm" />
                </TableCell>

                {/* Outlet */}
                <TableCell>
                  <span className="inline-flex items-center gap-[5px] text-foreground">
                    <MapPin
                      size={13}
                      className="flex-none text-muted-foreground"
                    />
                    {row.branch.name}
                  </span>
                </TableCell>

                {/* Location */}
                <TableCell className="text-muted-foreground">
                  {row.location || "—"}
                </TableCell>

                {/* Last serviced */}
                <TableCell
                  className="tabular-nums text-muted-foreground"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatShortDate(row.lastServiceDate)}
                </TableCell>

                {/* Next due */}
                <TableCell>
                  <StatusBadge
                    state={reminderState}
                    subLabel={snoozeSubLabel}
                    size="sm"
                    dueInDays={row.nextDueDate ? daysUntil(new Date(row.nextDueDate), today) : null}
                  />
                </TableCell>

                {/* Actions */}
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  {!hasAnyAction ? (
                    <Badge
                      variant="secondary"
                      className="text-[11px] text-muted-foreground"
                    >
                      Read-only
                    </Badge>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Row actions"
                        >
                          <MoreHorizontal size={17} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canLog && (
                          <DropdownMenuItem asChild>
                            <Link href={`/equipment/${row.id}/records/new`}>
                              Log maintenance
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {canSnooze && (
                          <DropdownMenuItem
                            onSelect={() => setSnoozeId(row.id)}
                          >
                            Snooze
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild>
                          <Link href={`/equipment/${row.id}`}>Open detail</Link>
                        </DropdownMenuItem>
                        {canManage && (
                        <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/equipment/${row.id}/edit`}>
                            Edit item
                          </Link>
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
                              setArchiveId(row.id);
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
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

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
