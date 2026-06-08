"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_CATEGORIES, categoryLabel } from "@/lib/equipment-display";

interface CostFiltersProps {
  outlets: { id: string; name: string }[];
  lockedOutletId?: string | null;
}

const RANGE_OPTIONS = [
  { value: "3m", label: "3 mo" },
  { value: "6m", label: "6 mo" },
  { value: "12m", label: "12 mo" },
] as const;

export function CostFilters({ outlets, lockedOutletId }: CostFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentOutlet = searchParams.get("outlet") ?? "";
  const currentCategory = searchParams.get("category") ?? "";
  const currentRange = searchParams.get("range") ?? "12m";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

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

      {/* Range toggle */}
      <div className="ml-auto flex items-center rounded-lg border bg-muted p-0.5">
        {RANGE_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setParam("range", value)}
            className={
              currentRange === value
                ? "rounded-md bg-background px-3 py-1.5 text-[13px] font-semibold shadow-sm"
                : "rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
