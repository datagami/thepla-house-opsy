"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { UserActions } from "./user-actions";

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

interface ColumnsProps {
  currentUserRole: string;
  branches: Array<{
    id: string;
    name: string;
  }>;
}

export const columns = ({ currentUserRole, branches }: ColumnsProps): ColumnDef<User>[] => [
  {
    accessorKey: "numId",
    header: "ID",
  },
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const role = row.getValue("role") as string;
      return (
        <Badge variant="outline" className="capitalize">
          {role.toLowerCase().replace("_", " ")}
        </Badge>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge 
          variant={status === "ACTIVE" ? "success" : status === "PENDING" ? "warning" : "destructive"}
          className="capitalize"
        >
          {status.toLowerCase()}
        </Badge>
      );
    },
  },
  {
    accessorKey: "branch",
    header: "Branch",
    cell: ({ row }) => {
      const branch = row.getValue("branch") as { name: string } | null;
      return branch ? branch.name : "-";
    },
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <UserActions 
        user={row.original}
        currentUserRole={currentUserRole}
        branches={branches}
      />
    ),
  },
]; 