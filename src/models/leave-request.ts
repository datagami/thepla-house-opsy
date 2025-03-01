import { LeaveType } from "@prisma/client";

export interface LeaveRequest {
  id: string;
  numId: number;
  userId: string;
  startDate: Date;
  endDate: Date;
  leaveType: LeaveType;
  reason: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
} 