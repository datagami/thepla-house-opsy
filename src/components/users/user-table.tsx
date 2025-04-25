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
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";

interface UserTableProps {
  users: User[];
  branches: Branch[];
  currentUserRole: string;
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

export function UserTable({ users, branches, currentUserRole }: UserTableProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const router = useRouter();

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase()) ||
      user.numId?.toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
    const matchesStatus = statusFilter === "ALL" || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

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
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Emp No.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.numId || "-"}</TableCell>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={roleColors[user.role as keyof typeof roleColors]}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusColors[user.status as keyof typeof statusColors]}>
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell>{user.branch?.name || "-"}</TableCell>
                <TableCell>{user.department}</TableCell>
                <TableCell>{user.doj ? formatDate(user.doj) : "-"}</TableCell>
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
