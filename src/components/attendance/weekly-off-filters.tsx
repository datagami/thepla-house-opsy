"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WeeklyOffFiltersProps {
  weeklyOff: string;
  weeklyOffType: string;
  weeklyOffDay: string;
  onWeeklyOffChange: (value: string) => void;
  onWeeklyOffTypeChange: (value: string) => void;
  onWeeklyOffDayChange: (value: string) => void;
}

export function WeeklyOffFilters({
  weeklyOff,
  weeklyOffType,
  weeklyOffDay,
  onWeeklyOffChange,
  onWeeklyOffTypeChange,
  onWeeklyOffDayChange,
}: WeeklyOffFiltersProps) {
  return (
    <>
      <Select value={weeklyOff} onValueChange={onWeeklyOffChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Weekly Off" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All</SelectItem>
          <SelectItem value="YES">Has Weekly Off</SelectItem>
          <SelectItem value="NO">No Weekly Off</SelectItem>
        </SelectContent>
      </Select>
      <Select value={weeklyOffType} onValueChange={onWeeklyOffTypeChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Types</SelectItem>
          <SelectItem value="FIXED">Fixed</SelectItem>
          <SelectItem value="FLEXIBLE">Flexible</SelectItem>
        </SelectContent>
      </Select>
      <Select value={weeklyOffDay} onValueChange={onWeeklyOffDayChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Day" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Days</SelectItem>
          <SelectItem value="0">Sunday</SelectItem>
          <SelectItem value="1">Monday</SelectItem>
          <SelectItem value="2">Tuesday</SelectItem>
          <SelectItem value="3">Wednesday</SelectItem>
          <SelectItem value="4">Thursday</SelectItem>
          <SelectItem value="5">Friday</SelectItem>
          <SelectItem value="6">Saturday</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}
