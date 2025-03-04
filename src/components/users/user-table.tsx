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
import AssignBranchModal from './assign-branch-modal';
import {Branch, User} from "@/models/models";


interface UserTableProps {
  users: User[];
  branches: Branch[];
  currentUserRole: string;
  onUserUpdate?: () => void;
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

export function UserTable({ users, branches, currentUserRole, onUserUpdate }: UserTableProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isAssignBranchModalOpen, setIsAssignBranchModalOpen] = useState(false);

  const handleAssignBranch = async (branchId: string) => {
    if (!selectedUser) return;

    try {
      const response = await fetch('/api/users/assign-branch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          branchId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign branch');
      }

      // Refresh the users list
      if (onUserUpdate) {
        onUserUpdate();
      }
      setIsAssignBranchModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error assigning branch:', error);
      throw error;
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase());

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
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
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
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setIsAssignBranchModalOpen(true);
                      }}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      Assign Branch
                    </button>
                    <UserActions 
                      user={user} 
                      branches={branches}
                      currentUserRole={currentUserRole}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      

      {isAssignBranchModalOpen && selectedUser && (
        <AssignBranchModal
          isOpen={isAssignBranchModalOpen}
          onClose={() => {
            setIsAssignBranchModalOpen(false);
            setSelectedUser(null);
          }}
          onAssign={handleAssignBranch}
          branches={branches}
          currentBranchId={selectedUser.branch?.id}
        />
      )}
    </div>
  );
} 
