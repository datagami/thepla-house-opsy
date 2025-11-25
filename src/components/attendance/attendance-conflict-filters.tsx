"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface AttendanceConflictFiltersProps {
  month: number;
  year: number;
}

const months = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export function AttendanceConflictFilters({ month, year }: AttendanceConflictFiltersProps) {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(month);
  const [selectedYear, setSelectedYear] = useState(year);

  const years = Array.from({ length: 5 }, (_, idx) => new Date().getFullYear() - idx);

  const updateUrl = (nextMonth: number, nextYear: number) => {
    const params = new URLSearchParams();
    params.set("month", nextMonth.toString());
    params.set("year", nextYear.toString());
    router.replace(`/hr/attendance-conflicts?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex gap-4">
      <Select
        value={selectedMonth.toString()}
        onValueChange={(value) => {
          const monthValue = parseInt(value);
          setSelectedMonth(monthValue);
          updateUrl(monthValue, selectedYear);
        }}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          {months.map((item) => (
            <SelectItem key={item.value} value={item.value.toString()}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedYear.toString()}
        onValueChange={(value) => {
          const yearValue = parseInt(value);
          setSelectedYear(yearValue);
          updateUrl(selectedMonth, yearValue);
        }}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          {years.map((item) => (
            <SelectItem key={item} value={item.toString()}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

