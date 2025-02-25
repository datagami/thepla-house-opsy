"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending Approval" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All Records" },
] as const;

interface AttendanceStatusFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function AttendanceStatusFilter({ value, onChange }: AttendanceStatusFilterProps) {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium">Filter by status:</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue>
            {STATUS_OPTIONS.find(option => option.value === value)?.label || "Select status"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
} 