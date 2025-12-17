"use client";

import { useState } from "react";
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
  INACTIVE: "text-red-600 bg-red-100",
} as const;

type SortField = 'numId' | 'name' | 'branch';
type SortOrder = 'asc' | 'desc';

export function  UserTable({ users, branches, currentUserRole }: UserTableProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [joiningFormFilter, setJoiningFormFilter] = useState("ALL");
  const [sortField, setSortField] = useState<SortField>('numId');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
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
    const matchesStatus = statusFilter === "ALL" || user.status === statusFilter;
    const matchesBranch = branchFilter === "ALL" || user.branch?.id === branchFilter;
    const matchesJoiningForm = 
      joiningFormFilter === "ALL" || 
      (joiningFormFilter === "PENDING" && !user.joiningFormSignedAt) ||
      (joiningFormFilter === "SIGNED" && !!user.joiningFormSignedAt);

    return matchesSearch && matchesRole && matchesStatus && matchesBranch && matchesJoiningForm;
  });

  const sortedUsers = sortUsers(filteredUsers);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
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
        <Select value={joiningFormFilter} onValueChange={setJoiningFormFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Joining Form" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Forms</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="SIGNED">Signed</SelectItem>
          </SelectContent>
        </Select>
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
                      ✓ Signed {new Date(user.joiningFormSignedAt).toLocaleDateString()}
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
