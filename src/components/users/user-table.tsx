"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserActions } from "./user-actions";
import {Branch, User} from "@/models/models";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateOnly } from "@/lib/utils";
import { MultiSelect } from "@/components/ui/multi-select";

interface UserTableProps {
  users: User[];
  branches: Branch[];
  currentUserRole: string;
  canEdit: boolean;
}

const roleColors = {
  EMPLOYEE: "text-blue-600 bg-blue-100",
  BRANCH_MANAGER: "text-purple-600 bg-purple-100",
  HR: "text-green-600 bg-green-100",
  MANAGEMENT: "text-orange-600 bg-orange-100",
} as const;

const statusColors = {
  PENDING: "text-yellow-600 bg-yellow-100",
  ACTIVE: "text-green-600 bg-green-100",
  PARTIAL_INACTIVE: "text-orange-700 bg-orange-100",
  INACTIVE: "text-red-600 bg-red-100",
} as const;

type SortField = 'numId' | 'name' | 'branch';
type SortOrder = 'asc' | 'desc';

const DEBOUNCE_MS = 400;

function readParams(sp: URLSearchParams) {
  return {
    search: sp.get("search") || "",
    role: sp.get("role") || "ALL",
    branch: sp.get("branch") || "ALL",
    joiningForm: sp.get("joiningForm") || "ALL",
    weeklyOff: sp.get("weeklyOff")?.split(",").filter(Boolean) || [] as string[],
    sortField: (sp.get("sortField") as SortField) || "numId",
    sortOrder: (sp.get("sortOrder") as SortOrder) || "asc",
  };
}

export function  UserTable({ users, branches, currentUserRole }: UserTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [joiningFormFilter, setJoiningFormFilter] = useState("ALL");
  const [weeklyOffFilters, setWeeklyOffFilters] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>("numId");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Initialize from URL on mount
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (initialized) return;
    const p = readParams(searchParams);
    setSearch(p.search);
    setRoleFilter(p.role);
    setBranchFilter(p.branch);
    setJoiningFormFilter(p.joiningForm);
    setWeeklyOffFilters(p.weeklyOff);
    setSortField(p.sortField);
    setSortOrder(p.sortOrder);
    setInitialized(true);
  }, [initialized, searchParams]);

  const updateUrl = useCallback(
    (updates: Record<string, string | string[] | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(updates)) {
        if (val === undefined || val === "" || val === "ALL" || (Array.isArray(val) && val.length === 0)) {
          p.delete(key);
        } else if (Array.isArray(val)) {
          p.set(key, val.join(","));
        } else {
          p.set(key, val);
        }
      }
      router.replace(`/users?${p.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Debounce search -> URL
  useEffect(() => {
    if (!initialized) return;
    const t = setTimeout(() => {
      updateUrl({ search: search || undefined });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search, initialized, updateUrl]);

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

  const handleSort = (field: SortField) => {
    const nextField = field;
    const nextOrder = sortField === field
      ? (sortOrder === "asc" ? "desc" : "asc")
      : "asc";
    setSortField(nextField);
    setSortOrder(nextOrder);
    updateUrl({ sortField: nextField, sortOrder: nextOrder });
  };

  const sortUsers = (users: User[]) => {
    return [...users].sort((a, b) => {
      const multiplier = sortOrder === 'asc' ? 1 : -1;
      
      switch (sortField) {
        case 'numId':
          return multiplier * ((a.numId || 0) - (b.numId || 0));
        case 'name':
          return multiplier * ((a.name || '').localeCompare(b.name || ''));
        case 'branch':
          return multiplier * ((a.branch?.name || '').localeCompare(b.branch?.name || ''));
        default:
          return 0;
      }
    });
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase()) ||
      user.numId?.toString().toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
    const matchesBranch = branchFilter === "ALL" || user.branch?.id === branchFilter;
    const matchesJoiningForm = 
      joiningFormFilter === "ALL" || 
      (joiningFormFilter === "PENDING" && !user.joiningFormSignedAt) ||
      (joiningFormFilter === "SIGNED" && !!user.joiningFormSignedAt);

    // Weekly off multi-select filter logic
    const matchesWeeklyOff = (() => {
      // If no filters selected, show all
      if (weeklyOffFilters.length === 0) {
        return true;
      }

      // Check if any selected filter matches (all require hasWeeklyOff except "none")
      for (const filter of weeklyOffFilters) {
        if (filter === "none" && !user.hasWeeklyOff) return true;
        if (filter === "flexible" && user.hasWeeklyOff && user.weeklyOffType === "FLEXIBLE") return true;
        // Check fixed day filters (0-6): hasWeeklyOff + FIXED + matching day
        if (/^[0-6]$/.test(filter) && user.hasWeeklyOff && user.weeklyOffType === "FIXED" && user.weeklyOffDay?.toString() === filter) {
          return true;
        }
      }

      return false;
    })();

    return matchesSearch && matchesRole && matchesBranch && matchesJoiningForm && matchesWeeklyOff;
  });

  const sortedUsers = sortUsers(filteredUsers);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={roleFilter}
          onValueChange={(v) => {
            setRoleFilter(v);
            updateUrl({ role: v });
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            <SelectItem value="EMPLOYEE">Employee</SelectItem>
            <SelectItem value="BRANCH_MANAGER">Branch Manager</SelectItem>
            <SelectItem value="HR">HR</SelectItem>
            <SelectItem value="MANAGEMENT">Management</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={branchFilter}
          onValueChange={(v) => {
            setBranchFilter(v);
            updateUrl({ branch: v });
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by branch" />
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
        <Select
          value={joiningFormFilter}
          onValueChange={(v) => {
            setJoiningFormFilter(v);
            updateUrl({ joiningForm: v });
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Joining Form" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Forms</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="SIGNED">Signed</SelectItem>
          </SelectContent>
        </Select>
        <div className="w-[300px]">
          <MultiSelect
            options={weeklyOffOptions}
            selected={weeklyOffFilters}
            onChange={(v) => {
              setWeeklyOffFilters(v);
              updateUrl({ weeklyOff: v });
            }}
            placeholder="Filter by Weekly Off"
          />
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('numId')}
                  className="h-8 flex items-center gap-1"
                >
                  Emp No.
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('name')}
                  className="h-8 flex items-center gap-1"
                >
                  Name
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Salary</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('branch')}
                  className="h-8 flex items-center gap-1"
                >
                  Branch
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Joining Form</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.numId || "-"}</TableCell>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.salary}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={roleColors[user.role as keyof typeof roleColors]}>
                    {user.role} {user.department?.name ? `(${user.department.name})` : ''}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusColors[user.status as keyof typeof statusColors]}>
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell>{user.branch?.name || "-"}</TableCell>
                <TableCell>
                  {user.joiningFormSignedAt ? (
                    <Badge variant="secondary" className="text-green-600 bg-green-100">
                      ✓ Signed {formatDateOnly(user.joiningFormSignedAt)}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-red-600 bg-red-100">
                      ⚠ Pending
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <UserActions 
                      user={user} 
                      currentUserRole={currentUserRole}
                      branches={branches}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 
