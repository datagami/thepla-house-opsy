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
import { useState } from "react";
import AssignBranchModal from "../users/assign-branch-modal";
import { Branch } from "@/models/models";

interface Employee {
  id: string;
  name: string | null;
  email: string | null;
  status: string;
  branch?: {
    id: string;
    name: string;
  } | null;
  _count: {
    attendance: number;
    leaveRequests: number;
  };
}

interface EmployeeTableProps {
  employees: Employee[];
  branches: Branch[];
  onEmployeeUpdate?: () => void;
}

export function EmployeeTable({ employees, branches, onEmployeeUpdate }: EmployeeTableProps) {
  const router = useRouter();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isAssignBranchModalOpen, setIsAssignBranchModalOpen] = useState(false);

  const handleAssignBranch = async (branchId: string) => {
    if (!selectedEmployee) return;

    try {
      const response = await fetch('/api/users/assign-branch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedEmployee.id,
          branchId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign branch');
      }

      // Refresh the employees list
      if (onEmployeeUpdate) {
        onEmployeeUpdate();
      }
      setIsAssignBranchModalOpen(false);
      setSelectedEmployee(null);
    } catch (error) {
      console.error('Error assigning branch:', error);
      throw error;
    }
  };

  return (
    <div>
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
                  variant={employee.status === "ACTIVE" ? "default" : "secondary"}
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
                  onClick={() => {
                    setSelectedEmployee(employee);
                    setIsAssignBranchModalOpen(true);
                  }}
                >
                  Assign Branch
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {isAssignBranchModalOpen && selectedEmployee && (
        <AssignBranchModal
          isOpen={isAssignBranchModalOpen}
          onClose={() => {
            setIsAssignBranchModalOpen(false);
            setSelectedEmployee(null);
          }}
          onAssign={handleAssignBranch}
          branches={branches}
          currentBranchId={selectedEmployee.branch?.id}
        />
      )}
    </div>
  );
} 
