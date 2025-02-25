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
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface Employee {
  id: string;
  name: string | null;
  email: string | null;
  status: string;
  _count: {
    attendance: number;
    leaveRequests: number;
  };
}

interface EmployeeTableProps {
  employees: Employee[];
}

export function EmployeeTable({ employees }: EmployeeTableProps) {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Days Present</TableHead>
          <TableHead>Leave Taken</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((employee) => (
          <TableRow key={employee.id}>
            <TableCell>{employee.name}</TableCell>
            <TableCell>{employee.email}</TableCell>
            <TableCell>{employee._count.attendance}</TableCell>
            <TableCell>{employee._count.leaveRequests}</TableCell>
            <TableCell>
              <Badge 
                variant={employee.status === "ACTIVE" ? "success" : "secondary"}
                className="capitalize"
              >
                {employee.status.toLowerCase()}
              </Badge>
            </TableCell>
            <TableCell className="text-right space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/attendance/${employee.id}`)}
              >
                View Attendance
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/leave-requests?userId=${employee.id}`)}
              >
                View Leaves
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
} 