export interface Employee {
  id: string;
  userId: string;
  branchId: string;
  employeeId: string;
  designation?: string;
  department?: string;
  joiningDate: Date;
  isActive: boolean;
} 