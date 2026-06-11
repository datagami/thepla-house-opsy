"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BranchActions } from "./branch-actions";
import { formatDate } from "@/lib/utils";

interface Branch {
  id: string;
  name: string;
  code?: string | null;
  city: string;
  state: string;
  address: string | null;
  createdAt: Date;
  _count: {
    users: number;
    managers: number;
  };
}

interface BranchTableProps {
  branches: Branch[];
}

export function BranchTable({ branches }: BranchTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Employees</TableHead>
            <TableHead>Managers</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {branches.map((branch) => (
            <TableRow key={branch.id}>
              <TableCell className="font-medium">
                <span>{branch.name}</span>
                {branch.code && (
                  <span className="ml-2 inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-mono font-medium text-muted-foreground">
                    {branch.code}
                  </span>
                )}
              </TableCell>
              <TableCell>{`${branch.city}, ${branch.state}`}</TableCell>
              <TableCell>{branch._count.users}</TableCell>
              <TableCell>{branch._count.managers}</TableCell>
              <TableCell>{formatDate(branch.createdAt)}</TableCell>
              <TableCell className="text-right">
                <BranchActions branch={branch} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 