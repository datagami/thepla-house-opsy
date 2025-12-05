"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DepartmentActions } from "./department-actions";
import { formatDate } from "@/lib/utils";

interface Department {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    users: number;
  };
}

interface DepartmentTableProps {
  departments: Department[];
}

export function DepartmentTable({ departments }: DepartmentTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Employees</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {departments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No departments found
              </TableCell>
            </TableRow>
          ) : (
            departments.map((department) => (
              <TableRow key={department.id}>
                <TableCell className="font-medium">{department.name}</TableCell>
                <TableCell className="max-w-md truncate">
                  {department.description || "-"}
                </TableCell>
                <TableCell>{department._count.users}</TableCell>
                <TableCell>
                  <Badge variant={department.isActive ? "default" : "secondary"}>
                    {department.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(department.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <DepartmentActions department={department} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

