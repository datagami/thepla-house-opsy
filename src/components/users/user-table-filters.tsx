"use client";

import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTableState } from "@/hooks/use-table-state";
import { useDebounce } from "@/hooks/use-debounce";

export function UserTableFilters() {
  const { search, status, role, updateTable } = useTableState();
  const [isPending, startTransition] = useTransition();

  const debouncedSearch = useDebounce((value: string) => {
    startTransition(() => {
      updateTable({ search: value || null, page: 1 });
    });
  }, 500);

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <Input
          placeholder="Search users..."
          defaultValue={search}
          onChange={(e) => debouncedSearch(e.target.value)}
        />
      </div>
      <Select
        defaultValue={status}
        onValueChange={(value) => {
          startTransition(() => {
            updateTable({ status: value === "all" ? null : value, page: 1 });
          });
        }}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="PENDING">Pending</SelectItem>
          <SelectItem value="ACTIVE">Active</SelectItem>
          <SelectItem value="INACTIVE">Inactive</SelectItem>
        </SelectContent>
      </Select>
      <Select
        defaultValue={role}
        onValueChange={(value) => {
          startTransition(() => {
            updateTable({ role: value === "all" ? null : value, page: 1 });
          });
        }}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Roles</SelectItem>
          <SelectItem value="EMPLOYEE">Employee</SelectItem>
          <SelectItem value="BRANCH_MANAGER">Branch Manager</SelectItem>
          <SelectItem value="HR">HR</SelectItem>
          <SelectItem value="MANAGEMENT">Management</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
} 