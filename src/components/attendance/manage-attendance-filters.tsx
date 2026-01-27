"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Branch } from "@/models/models";
import { MultiSelect } from "@/components/ui/multi-select";

interface ManageAttendanceFiltersProps {
  branches: Branch[];
}

export function ManageAttendanceFilters({ branches }: ManageAttendanceFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.replace(`?${params.toString()}`);
  };

  const handleWeeklyOffChange = (values: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (values.length === 0) {
      params.delete("weeklyOff");
    } else {
      params.set("weeklyOff", values.join(","));
    }
    router.replace(`?${params.toString()}`);
  };

  const weeklyOffOptions = [
    { label: "No Weekly Off", value: "none" },
    { label: "Flexible Weekly Off", value: "flexible" },
    { label: "Sunday (Fixed)", value: "0" },
    { label: "Monday (Fixed)", value: "1" },
    { label: "Tuesday (Fixed)", value: "2" },
    { label: "Wednesday (Fixed)", value: "3" },
    { label: "Thursday (Fixed)", value: "4" },
    { label: "Friday (Fixed)", value: "5" },
    { label: "Saturday (Fixed)", value: "6" },
  ];

  const branch = searchParams.get("branch") || "ALL";
  const role = searchParams.get("role") || "ALL";
  const status = searchParams.get("status") || "ACTIVE";
  const weeklyOffParam = searchParams.get("weeklyOff");
  const weeklyOffFilters = weeklyOffParam ? weeklyOffParam.split(",") : [];

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <Select value={role} onValueChange={(value) => handleFilterChange("role", value)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Roles</SelectItem>
          <SelectItem value="EMPLOYEE">Employee</SelectItem>
          <SelectItem value="BRANCH_MANAGER">Branch Manager</SelectItem>
          <SelectItem value="HR">HR</SelectItem>
          <SelectItem value="MANAGEMENT">Management</SelectItem>
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={(value) => handleFilterChange("status", value)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Status</SelectItem>
          <SelectItem value="ACTIVE">Active</SelectItem>
          <SelectItem value="PENDING">Pending</SelectItem>
          <SelectItem value="PARTIAL_INACTIVE">Partial Inactive</SelectItem>
          <SelectItem value="INACTIVE">Inactive</SelectItem>
        </SelectContent>
      </Select>

      <Select value={branch} onValueChange={(value) => handleFilterChange("branch", value)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Branch" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Branches</SelectItem>
          {branches.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="w-[300px]">
        <MultiSelect
          options={weeklyOffOptions}
          selected={weeklyOffFilters}
          onChange={handleWeeklyOffChange}
          placeholder="Filter by Weekly Off"
        />
      </div>
    </div>
  );
}
