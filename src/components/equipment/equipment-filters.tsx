"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Filter, X, SlidersHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { ALL_CATEGORIES, categoryLabel } from "@/lib/equipment-display";

interface EquipmentFiltersProps {
  outlets: { id: string; name: string }[];
  lockedOutletId?: string | null;
  lifecycle?: string;
}

const STATUS_OPTIONS = [
  { value: "overdue", label: "Overdue" },
  { value: "due-soon", label: "Due soon" },
  { value: "snoozed", label: "Snoozed" },
  { value: "ok", label: "On track" },
] as const;

const LIFECYCLE_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All" },
] as const;

export function EquipmentFilters({
  outlets,
  lockedOutletId,
  lifecycle: lifecycleProp,
}: EquipmentFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentOutlet = searchParams.get("outlet") ?? "";
  const currentCategory = searchParams.get("category") ?? "";
  const currentStatus = searchParams.get("status") ?? "";
  // lifecycle: read from prop (server-driven) if provided, else fall back to URL param
  const currentLifecycle =
    lifecycleProp ?? searchParams.get("lifecycle") ?? "active";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function setLifecycle(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "active" || !value) {
      params.delete("lifecycle");
    } else {
      params.set("lifecycle", value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    if (!lockedOutletId) params.delete("outlet");
    params.delete("category");
    params.delete("status");
    params.delete("lifecycle");
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasActiveFilter =
    (currentOutlet && !lockedOutletId) ||
    currentCategory ||
    currentStatus ||
    (currentLifecycle && currentLifecycle !== "active");

  const activeCount =
    (currentOutlet && !lockedOutletId ? 1 : 0) +
    (currentCategory ? 1 : 0) +
    (currentStatus ? 1 : 0) +
    (currentLifecycle && currentLifecycle !== "active" ? 1 : 0);

  return (
    <>
      {/* ── Desktop: inline selects (md and up) ─────────────────────────── */}
      <div className="hidden md:flex flex-wrap items-center gap-2.5">
        {/* Label */}
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-[550] text-muted-foreground">
          <Filter size={14} />
          Filter
        </span>

        {/* Outlet */}
        <Select
          value={lockedOutletId ? lockedOutletId : currentOutlet || "ALL"}
          disabled={!!lockedOutletId}
          onValueChange={(v) => setParam("outlet", v === "ALL" ? "" : v)}
        >
          <SelectTrigger
            className="h-[34px] min-w-[140px] text-[13px]"
            style={{ opacity: lockedOutletId ? 0.65 : 1 }}
          >
            <SelectValue placeholder="All outlets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All outlets</SelectItem>
            {outlets.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category */}
        <Select
          value={currentCategory || "ALL"}
          onValueChange={(v) => setParam("category", v === "ALL" ? "" : v)}
        >
          <SelectTrigger className="h-[34px] min-w-[168px] text-[13px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {ALL_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {categoryLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status */}
        <Select
          value={currentStatus || "ALL"}
          onValueChange={(v) => setParam("status", v === "ALL" ? "" : v)}
        >
          <SelectTrigger className="h-[34px] min-w-[140px] text-[13px]">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any status</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Lifecycle */}
        <Select
          value={currentLifecycle || "active"}
          onValueChange={(v) => setLifecycle(v)}
        >
          <SelectTrigger className="h-[34px] min-w-[120px] text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIFECYCLE_OPTIONS.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear */}
        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-[34px] gap-1.5 text-[13px]"
          >
            <X size={13} />
            Clear
          </Button>
        )}
      </div>

      {/* ── Mobile: Filters button → bottom sheet (below md) ────────────── */}
      <div className="flex items-center gap-2 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="relative h-8 gap-1.5 text-[13px]"
            >
              <SlidersHorizontal size={14} />
              Filters
              {activeCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary text-[9.5px] font-bold text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-[20px] px-[18px] pb-6 pt-3">
            {/* Drag handle */}
            <div className="mx-auto mb-4 h-[4px] w-9 rounded-full bg-border" />
            <SheetHeader className="mb-4 text-left">
              <SheetTitle className="text-[16px]">Filters</SheetTitle>
            </SheetHeader>

            <div className="flex flex-col gap-4">
              {/* Outlet */}
              {!lockedOutletId && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12.5px] font-[550] text-muted-foreground">
                    Outlet
                  </Label>
                  <Select
                    value={currentOutlet || "ALL"}
                    onValueChange={(v) => setParam("outlet", v === "ALL" ? "" : v)}
                  >
                    <SelectTrigger className="h-10 text-[13px]">
                      <SelectValue placeholder="All outlets" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All outlets</SelectItem>
                      {outlets.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Category */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12.5px] font-[550] text-muted-foreground">
                  Category
                </Label>
                <Select
                  value={currentCategory || "ALL"}
                  onValueChange={(v) => setParam("category", v === "ALL" ? "" : v)}
                >
                  <SelectTrigger className="h-10 text-[13px]">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All categories</SelectItem>
                    {ALL_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {categoryLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12.5px] font-[550] text-muted-foreground">
                  Status
                </Label>
                <Select
                  value={currentStatus || "ALL"}
                  onValueChange={(v) => setParam("status", v === "ALL" ? "" : v)}
                >
                  <SelectTrigger className="h-10 text-[13px]">
                    <SelectValue placeholder="Any status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Any status</SelectItem>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Lifecycle */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12.5px] font-[550] text-muted-foreground">
                  Lifecycle
                </Label>
                <Select
                  value={currentLifecycle || "active"}
                  onValueChange={(v) => setLifecycle(v)}
                >
                  <SelectTrigger className="h-10 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LIFECYCLE_OPTIONS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sheet footer actions */}
            <div className="mt-6 flex gap-2.5">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={clearAll}
              >
                Clear
              </Button>
              <SheetTrigger asChild>
                <Button className="flex-1">Show results</Button>
              </SheetTrigger>
            </div>
          </SheetContent>
        </Sheet>

        {/* Show active-filter summary inline */}
        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-8 gap-1 text-[12px] text-muted-foreground"
          >
            <X size={12} />
            Clear
          </Button>
        )}
      </div>
    </>
  );
}
