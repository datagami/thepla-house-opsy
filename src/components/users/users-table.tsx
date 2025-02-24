"use client";

import { DataTable } from "@/components/users/data-table";
import { columns } from "@/components/users/columns";

interface User {
  id: string;
  numId: number;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
  branch: {
    name: string;
  } | null;
}

interface Branch {
  id: string;
  name: string;
}

interface UsersTableProps {
  users: User[];
  branches: Branch[];
  currentUserRole: string;
}

export function UsersTable({ users, branches, currentUserRole }: UsersTableProps) {
  return (
    <DataTable 
      columns={columns({ 
        currentUserRole,
        branches,
      })} 
      data={users} 
    />
  );
} 