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
import { WarningTypeActions } from "./warning-type-actions";
import { formatDate } from "@/lib/utils";

interface WarningType {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    warnings: number;
  };
}

interface WarningTypeTableProps {
  warningTypes: WarningType[];
}

export function WarningTypeTable({ warningTypes }: WarningTypeTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Warnings Count</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {warningTypes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No warning types found
              </TableCell>
            </TableRow>
          ) : (
            warningTypes.map((warningType) => (
              <TableRow key={warningType.id}>
                <TableCell className="font-medium">{warningType.name}</TableCell>
                <TableCell className="max-w-md truncate">
                  {warningType.description || "-"}
                </TableCell>
                <TableCell>{warningType._count.warnings}</TableCell>
                <TableCell>
                  <Badge variant={warningType.isActive ? "default" : "secondary"}>
                    {warningType.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(warningType.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <WarningTypeActions warningType={warningType} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
