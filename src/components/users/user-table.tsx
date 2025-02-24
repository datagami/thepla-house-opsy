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
import { UserActions } from "./user-actions";
import { formatDate } from "@/lib/utils";
import { useTableState } from "@/hooks/use-table-state";
import { Pagination } from "@/components/ui/pagination";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  branch?: { name: string } | null;
  approvedBy?: { name: string } | null;
  createdAt: Date;
}

interface UserTableProps {
  users: User[];
  currentPage: number;
  totalPages: number;
}

const roleColors = {
  EMPLOYEE: "bg-blue-100 text-blue-800",
  BRANCH_MANAGER: "bg-purple-100 text-purple-800",
  HR: "bg-green-100 text-green-800",
  MANAGEMENT: "bg-orange-100 text-orange-800",
};

const statusColors = {
  PENDING: "bg-yellow-100 text-yellow-800",
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-red-100 text-red-800",
};

export function UserTable({ users, currentPage, totalPages }: UserTableProps) {
  const { updateTable } = useTableState();

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Approved By</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={roleColors[user.role]}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusColors[user.status]}>
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell>{user.branch?.name || "-"}</TableCell>
                <TableCell>{user.approvedBy?.name || "-"}</TableCell>
                <TableCell>{formatDate(user.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <UserActions user={user} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => updateTable({ page })}
      />
    </div>
  );
} 