"use client";

import { cn } from "@/lib/utils";
import {
  CATEGORY_META,
  TYPE_TINT,
  maintenanceTypeLabel,
  stateBadge,
} from "@/lib/equipment-display";
import type { ReminderState } from "@/lib/services/maintenance-schedule";
import { CategoryIcon } from "./category-icon";

// ─── CategoryPill ─────────────────────────────────────────────────────────────

interface CategoryPillProps {
  category: string;
  size?: "sm" | "md";
}

export function CategoryPill({ category, size = "md" }: CategoryPillProps) {
  const m = CATEGORY_META[category] ?? CATEGORY_META["OTHER"];
  const fontSize = size === "sm" ? 11 : 12;
  const iconSize = size === "sm" ? 12 : 13;

  return (
    <span
      className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[9px] py-[4px] pl-[7px] font-semibold leading-none"
      style={{
        background: m.bg,
        color: m.fg,
        fontSize,
      }}
    >
      <CategoryIcon name={m.icon} size={iconSize} strokeWidth={2.2} />
      {m.label}
    </span>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  state: ReminderState;
  subLabel?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ state, subLabel, size = "md" }: StatusBadgeProps) {
  const badge = stateBadge(state);
  const fontSize = size === "sm" ? 11 : 12;
  const iconSize = size === "sm" ? 11 : 12.5;
  const padding = size === "sm" ? "3px 8px" : "4px 9px";

  return (
    <span
      className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full font-semibold leading-none border"
      style={{
        background: badge.bg,
        color: badge.fg,
        borderColor: badge.border,
        fontSize,
        padding,
      }}
    >
      <CategoryIcon name={badge.icon} size={iconSize} strokeWidth={2.3} />
      <span>{badge.label}</span>
      {subLabel && (
        <span style={{ opacity: 0.7, fontWeight: 500 }}>{subLabel}</span>
      )}
    </span>
  );
}

// ─── TypeBadge ───────────────────────────────────────────────────────────────

interface TypeBadgeProps {
  type: string;
}

export function TypeBadge({ type }: TypeBadgeProps) {
  const t = TYPE_TINT[type] ?? { fg: "#3f3f46", bg: "#f4f4f5" };

  return (
    <span
      className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[9px] py-[4px] text-xs font-semibold leading-none border border-transparent"
      style={{
        background: t.bg,
        color: t.fg,
      }}
    >
      {maintenanceTypeLabel(type)}
    </span>
  );
}

// ─── DoneBadge ───────────────────────────────────────────────────────────────

interface DoneBadgeProps {
  status: "DONE" | "PENDING" | string;
}

export function DoneBadge({ status }: DoneBadgeProps) {
  if (status === "DONE") {
    return (
      <span
        className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[9px] py-[4px] text-xs font-semibold leading-none border"
        style={{
          background: "#f0fdf4",
          color: "#15803d",
          borderColor: "#bbf7d0",
        }}
      >
        <CategoryIcon name="check" size={11} strokeWidth={2.5} />
        Done
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[9px] py-[4px] text-xs font-semibold leading-none border"
      style={{
        background: "#fffbeb",
        color: "#b45309",
        borderColor: "#fde68a",
      }}
    >
      <CategoryIcon name="clock" size={11} />
      Pending
    </span>
  );
}

// ─── StatCard ────────────────────────────────────────────────────────────────

type StatCardTone = "red" | "amber" | "neutral";

interface StatCardToneColors {
  fg: string;
  bg: string;
  bar: string;
  ring: string;
}

const STAT_TONES: Record<StatCardTone, StatCardToneColors> = {
  red:     { fg: "#b91c1c", bg: "#fef2f2", bar: "#dc2626", ring: "#fecaca" },
  amber:   { fg: "#b45309", bg: "#fffbeb", bar: "#f59e0b", ring: "#fde68a" },
  neutral: { fg: "#3f3f46", bg: "#fafafa", bar: "#a1a1aa", ring: "#e4e4e7" },
};

interface StatCardProps {
  tone: StatCardTone;
  value: React.ReactNode;
  label: string;
  icon: string;
  active?: boolean;
  onClick?: () => void;
}

export function StatCard({
  tone,
  value,
  label,
  icon,
  active,
  onClick,
}: StatCardProps) {
  const t = STAT_TONES[tone];

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative overflow-hidden flex flex-1 items-center gap-[14px] rounded-xl border bg-white px-4 py-[14px] text-left transition-[border-color,box-shadow] duration-[140ms]",
        onClick ? "cursor-pointer" : "cursor-default"
      )}
      style={{
        borderColor: active ? t.bar : "#e4e4e7",
        boxShadow: active
          ? `0 0 0 3px ${t.bg}`
          : "0 1px 2px 0 rgba(24,24,27,.05)",
      }}
      type="button"
    >
      {/* Icon square */}
      <div
        className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px]"
        style={{ background: t.bg, color: t.fg }}
      >
        <CategoryIcon name={icon} size={20} strokeWidth={2.2} />
      </div>

      {/* Text */}
      <div className="min-w-0">
        <div
          className="text-2xl font-bold leading-[1.1] tracking-[-0.02em] tabular-nums text-foreground"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </div>
        <div className="mt-[2px] text-[12.5px] font-[550] text-muted-foreground">
          {label}
        </div>
      </div>
    </button>
  );
}

// ─── EquipmentEmptyState ──────────────────────────────────────────────────────

interface EquipmentEmptyStateProps {
  icon?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export function EquipmentEmptyState({
  icon = "package",
  title,
  body,
  action,
  compact,
}: EquipmentEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center text-center"
      style={{ padding: compact ? "32px 20px" : "56px 24px" }}
    >
      {/* Icon tile */}
      <div
        className="mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-muted text-muted-foreground"
      >
        <CategoryIcon name={icon} size={24} />
      </div>

      <div className="text-[15px] font-[650] text-foreground">{title}</div>

      {body && (
        <div className="mt-[6px] max-w-[300px] text-[13px] leading-[1.5] text-muted-foreground">
          {body}
        </div>
      )}

      {action && <div className="mt-[18px]">{action}</div>}
    </div>
  );
}
