"use client";

import {
  Flame,
  Snowflake,
  ChefHat,
  Zap,
  Droplet,
  Bug,
  Sparkles,
  Package,
  AlertTriangle,
  Clock,
  Check,
  Moon,
  Minus,
  Wrench,
  Search,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  flame: Flame,
  snowflake: Snowflake,
  "chef-hat": ChefHat,
  zap: Zap,
  droplet: Droplet,
  bug: Bug,
  sparkles: Sparkles,
  package: Package,
  "alert-triangle": AlertTriangle,
  clock: Clock,
  check: Check,
  moon: Moon,
  minus: Minus,
  wrench: Wrench,
  search: Search,
};

interface CategoryIconProps {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function CategoryIcon({
  name,
  size = 16,
  className,
  strokeWidth,
}: CategoryIconProps) {
  const Icon = ICON_MAP[name] ?? Package;
  return <Icon size={size} className={className} strokeWidth={strokeWidth} />;
}
