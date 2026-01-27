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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarDays, Building2, Shirt, AlertTriangle } from "lucide-react";
import { UniformForm } from "@/components/users/uniform-form";
import { WarningForm } from "@/components/users/warning-form";
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
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => router.push(`/attendance/${employee.id}`)}
                        >
                          <CalendarDays className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View Attendance</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {/* Assign Branch */}
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setIsAssignBranchModalOpen(true);
                          }}
                        >
                          <Building2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Assign Branch</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {/* Issue Uniform (Shirt only) */}
                        <div>
                          <UniformForm
                            userId={employee.id}
                            userName={employee.name}
                            trigger={
                              <Button variant="outline" size="icon">
                                <Shirt className="h-4 w-4" />
                              </Button>
                            }
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Issue Uniform</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {/* Register Warning */}
                        <div>
                          <WarningForm
                            userId={employee.id}
                            userName={employee.name}
                            trigger={
                              <Button variant="outline" size="icon">
                                <AlertTriangle className="h-4 w-4" />
                              </Button>
                            }
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Register Warning</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
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
