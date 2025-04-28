"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AttendanceBranchFilterProps {
  value: string;
  onChange: (value: string) => void;
  branches: string[];
}

export function AttendanceBranchFilter({ value, onChange, branches }: AttendanceBranchFilterProps) {
  return (
    <div className="flex items-center space-x-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue>
            {value === "ALL" ? "All Branches" : value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Branches</SelectItem>
          {branches.map((branch) => (
            <SelectItem key={branch} value={branch}>
              {branch}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
} 