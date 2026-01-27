"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AdvancesFiltersProps {
  filters: {
    search: string;
    status: string;
    fromDate: string;
    toDate: string;
    branchId: string;
  };
  onFilterChange: (filters: any) => void;
  isHROrManagement: boolean;
}

export function AdvancesFilters({
  filters,
  onFilterChange,
  isHROrManagement,
}: AdvancesFiltersProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const [branches, setBranches] = useState<any[]>([]);
  const [fromDate, setFromDate] = useState<Date | undefined>(
    filters.fromDate ? new Date(filters.fromDate) : undefined
  );
  const [toDate, setToDate] = useState<Date | undefined>(
    filters.toDate ? new Date(filters.toDate) : undefined
  );

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onFilterChange({ ...filters, search: localSearch });
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearch]);

  // Fetch branches if HR/Management
  useEffect(() => {
    if (isHROrManagement) {
      fetchBranches();
    }
  }, [isHROrManagement]);

  const fetchBranches = async () => {
    try {
      const response = await fetch("/api/branches");
      if (response.ok) {
        const data = await response.json();
        setBranches(data);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const handleStatusChange = (value: string) => {
    onFilterChange({ ...filters, status: value });
  };

  const handleBranchChange = (value: string) => {
    onFilterChange({ ...filters, branchId: value });
  };

  const handleFromDateChange = (date: Date | undefined) => {
    setFromDate(date);
    onFilterChange({
      ...filters,
      fromDate: date ? format(date, "yyyy-MM-dd") : "",
    });
  };

  const handleToDateChange = (date: Date | undefined) => {
    setToDate(date);
    onFilterChange({
      ...filters,
      toDate: date ? format(date, "yyyy-MM-dd") : "",
    });
  };

  const handleReset = () => {
    setLocalSearch("");
    setFromDate(undefined);
    setToDate(undefined);
    onFilterChange({
      search: "",
      status: "ALL",
      fromDate: "",
      toDate: "",
      branchId: "ALL",
    });
  };

  const activeFiltersCount = [
    filters.search,
    filters.status !== "ALL",
    filters.fromDate,
    filters.toDate,
    filters.branchId !== "ALL",
  ].filter(Boolean).length;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            {isHROrManagement && (
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or employee ID..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}

            {/* Status Filter */}
            <Select value={filters.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="SETTLED">Settled</SelectItem>
              </SelectContent>
            </Select>

            {/* From Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    !fromDate && "text-muted-foreground"
                  )}
                >
                  {fromDate ? format(fromDate, "MMM d, yyyy") : "From Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={fromDate}
                  onSelect={handleFromDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* To Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[180px] justify-start text-left font-normal",
                    !toDate && "text-muted-foreground"
                  )}
                >
                  {toDate ? format(toDate, "MMM d, yyyy") : "To Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={toDate}
                  onSelect={handleToDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Branch Filter (HR/Management only) */}
            {isHROrManagement && branches.length > 0 && (
              <Select
                value={filters.branchId}
                onValueChange={handleBranchChange}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Reset Button */}
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                onClick={handleReset}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Reset
                <Badge variant="secondary" className="ml-1">
                  {activeFiltersCount}
                </Badge>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
