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
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "3m", label: "3 mo" },
  { value: "6m", label: "6 mo" },
  { value: "12m", label: "12 mo" },
  { value: "custom", label: "Custom" },
] as const;

export function CostFilters({ outlets, lockedOutletId }: CostFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentOutlet = searchParams.get("outlet") ?? "";
  const currentCategory = searchParams.get("category") ?? "";
  const currentRange = searchParams.get("range") ?? "12m";
  const fromVal = searchParams.get("from") ?? "";
  const toVal = searchParams.get("to") ?? "";

  // A branch manager has a single outlet, so the outlet filter is hidden for them.
  const showOutlet = !lockedOutletId;

  function setParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value && value !== "ALL") params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function setRange(value: string) {
    // Leaving Custom clears the from/to dates; entering it keeps them.
    if (value === "custom") setParams({ range: "custom" });
    else setParams({ range: value, from: null, to: null });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Label */}
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-[550] text-muted-foreground">
          <Filter size={14} />
          Filter
        </span>

        {/* Outlet — only for HR/MANAGEMENT (branch managers have one outlet) */}
        {showOutlet && (
          <Select
            value={currentOutlet || "ALL"}
            onValueChange={(v) => setParams({ outlet: v === "ALL" ? null : v })}
          >
            <SelectTrigger className="h-[34px] min-w-[140px] text-[13px]">
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
        )}

        {/* Category */}
        <Select
          value={currentCategory || "ALL"}
          onValueChange={(v) => setParams({ category: v === "ALL" ? null : v })}
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

        {/* Range presets */}
        <div className="flex flex-wrap items-center gap-0.5 rounded-lg border bg-muted p-0.5 md:ml-auto">
          {RANGE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              className={
                currentRange === value
                  ? "rounded-md bg-background px-2.5 py-1.5 text-[13px] font-semibold shadow-sm"
                  : "rounded-md px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range — only when "Custom" is selected */}
      {currentRange === "custom" && (
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[12.5px] font-[550] text-muted-foreground">
            From
          </span>
          <input
            type="date"
            value={fromVal}
            max={toVal || undefined}
            onChange={(e) => setParams({ from: e.target.value || null })}
            className="h-[34px] rounded-md border bg-background px-2.5 text-[13px]"
          />
          <span className="text-[12.5px] font-[550] text-muted-foreground">
            To
          </span>
          <input
            type="date"
            value={toVal}
            min={fromVal || undefined}
            onChange={(e) => setParams({ to: e.target.value || null })}
            className="h-[34px] rounded-md border bg-background px-2.5 text-[13px]"
          />
          {(fromVal || toVal) && (
            <button
              type="button"
              onClick={() => setParams({ from: null, to: null })}
              className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear dates
            </button>
          )}
        </div>
      )}
    </div>
  );
}
