import { UserRole, UserStatus } from "@prisma/client";

export interface User {
  id: string;
  numId: number;
  name?: string | null;
  email?: string | null;
  emailVerified?: Date | null;
  password?: string | null;
  role: UserRole;
  status: UserStatus;
  image?: string | null;
  branchId?: string | null;
  managedBranchId?: string | null;
  selectedBranchId?: string | null;
  approvedById?: string | null;
  createdAt: Date;
  updatedAt: Date;
} 