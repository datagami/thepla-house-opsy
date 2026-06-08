"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Filter, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ALL_CATEGORIES, categoryLabel } from "@/lib/equipment-display";

interface EquipmentFiltersProps {
  outlets: { id: string; name: string }[];
  lockedOutletId?: string | null;
}

const STATUS_OPTIONS = [
  { value: "overdue", label: "Overdue" },
  { value: "due-soon", label: "Due soon" },
  { value: "snoozed", label: "Snoozed" },
  { value: "ok", label: "On track" },
] as const;

export function EquipmentFilters({
  outlets,
  lockedOutletId,
}: EquipmentFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentOutlet = searchParams.get("outlet") ?? "";
  const currentCategory = searchParams.get("category") ?? "";
  const currentStatus = searchParams.get("status") ?? "";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    if (!lockedOutletId) params.delete("outlet");
    params.delete("category");
    params.delete("status");
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasActiveFilter =
    (currentOutlet && !lockedOutletId) || currentCategory || currentStatus;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
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
  );
}
