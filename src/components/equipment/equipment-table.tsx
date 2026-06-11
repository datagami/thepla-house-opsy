"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MapPin, MoreHorizontal, Archive, ArchiveRestore, Printer, Search, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Pagination } from "@/components/ui/pagination";
import { CategoryPill, StatusBadge } from "@/components/equipment/ui";
import { SnoozeDialog } from "@/components/equipment/snooze-dialog";
import { ArchiveDialog } from "@/components/equipment/archive-dialog";
import { getReminderState, daysUntil } from "@/lib/services/maintenance-schedule";

export interface EquipmentRow {
  id: string;
  assetTag: string;
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
  /** Grand total in scope (ignores the dropdown filters + search) — for the "N of M" summary. */
  totalCount: number;
  /** Branch managers have a locked outlet — Reset preserves it. */
  lockedOutletId?: string | null;
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
  totalCount,
  lockedOutletId,
}: EquipmentTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [snoozeId, setSnoozeId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  // Clear the search AND the dropdown filter params (outlet/category/status/lifecycle),
  // preserving a branch manager's locked outlet.
  const resetAll = () => {
    setQuery("");
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    ["category", "status", "lifecycle"].forEach((k) => params.delete(k));
    if (!lockedOutletId) params.delete("outlet");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  // Client-side search by item name, asset ID (label tag), or location.
  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.assetTag, r.location].some((v) => v?.toLowerCase().includes(q))
    );
  }, [rows, query]);

  // Client-side pagination over the searched rows.
  const PAGE_SIZE = 25;
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = visibleRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  // Jump back to the first page whenever the search changes.
  useEffect(() => {
    setPage(1);
  }, [query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clear = () => setSelected(new Set());
  const allSelected =
    visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.id));
  const someSelected = selected.size > 0 && !allSelected;

  const today = new Date();
  const snoozeRow = rows.find((r) => r.id === snoozeId);
  const archiveRow = rows.find((r) => r.id === archiveId);
  const hasAnyAction = canManage || canSnooze || canLog;

  return (
    <>
      {/* Search by name / asset ID / location */}
      <div className="relative mb-2">
        <Search
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, asset ID, or location…"
          aria-label="Search items by name, asset ID, or location"
          className="h-9 pl-8 pr-9 text-[13px]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Result summary — shown whenever ANY filter (search OR dropdown) narrows the list */}
      {(query.trim().length > 0 || visibleRows.length < totalCount) && (
        <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
          {visibleRows.length === 0 ? (
            <span>
              No items match{" "}
              {query.trim() ? (
                <>&ldquo;<span className="text-foreground">{query.trim()}</span>&rdquo;</>
              ) : (
                "the current filters"
              )}
              .
            </span>
          ) : (
            <span>
              Showing <strong className="text-foreground">{visibleRows.length}</strong> of{" "}
              {totalCount} item{totalCount === 1 ? "" : "s"}
            </span>
          )}
          <button
            type="button"
            onClick={resetAll}
            className="font-medium text-primary hover:underline"
          >
            Reset
          </button>
        </div>
      )}

      {/* Selection bar */}
      {canManage && selected.size > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-[13px] mb-3">
          <span className="text-muted-foreground">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm" asChild>
              <a
                href={`/api/equipment/labels?ids=${[...selected].join(",")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Printer size={15} className="mr-1.5" />
                Print labels
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={clear}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Mobile: card list */}
      <div className="md:hidden">
        <EquipmentCards
          rows={pageRows}
          canManage={canManage}
          canSnooze={canSnooze}
          canLog={canLog}
          selected={selected}
          onToggle={toggle}
        />
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            {canManage && (
              <TableHead className="w-[36px]">
                <Checkbox
                  checked={someSelected ? "indeterminate" : allSelected}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelected(new Set(visibleRows.map((r) => r.id)));
                    } else {
                      clear();
                    }
                  }}
                  aria-label="Select all items"
                />
              </TableHead>
            )}
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
          {pageRows.map((row) => {
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
                {canManage && (
                  <TableCell
                    className="w-[36px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selected.has(row.id)}
                      onCheckedChange={() => toggle(row.id)}
                      aria-label="Select item"
                    />
                  </TableCell>
                )}
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
                  <div className="mt-[2px] flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    <span className="font-mono">{row.assetTag}</span>
                    <span aria-hidden>·</span>
                    <span>
                      {row.frequencyMonths
                        ? `Every ${row.frequencyMonths} months`
                        : "One-off"}
                    </span>
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

      {/* Pagination — applies to both the desktop table and mobile cards */}
      {totalPages > 1 && (
        <div className="mt-4 border-t pt-4">
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            totalItems={visibleRows.length}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      )}

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
