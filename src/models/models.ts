type UserRole = "EMPLOYEE" | "BRANCH_MANAGER" | "HR" | "MANAGEMENT";

type UserStatus = "PENDING" | "ACTIVE" | "INACTIVE";

type LeaveType = "CASUAL" | "SICK" | "ANNUAL" | "UNPAID" | "OTHER";

type AttendanceStatus = "PENDING_VERIFICATION" | "APPROVED" | "REJECTED";

export interface Account {
  id: string;
  numId: number;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token?: string | null;
  access_token?: string | null;
  expires_at?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
  session_state?: string | null;
  user: User;
}

export interface Session {
  id: string;
  numId: number;
  sessionToken: string;
  userId: string;
  expires: Date;
  user: User;
}

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
  title?: string | null;
  doj?: Date | null;
  department?: string | null;
  mobileNo?: string | null;
  dob?: Date | null;
  gender?: string | null;
  panNo?: string | null;
  aadharNo?: string | null;
  salary?: number | null;
  references: Reference[];
  accounts: Account[];
  sessions: Session[];
  branch?: Branch | null;
  managedBranch?: Branch | null;
  selectedBranch?: Branch | null;
  attendance: Attendance[];
  leaveRequests: LeaveRequest[];
  approvedBy?: User | null;
  approvedUsers: User[];
  verifiedAttendance: Attendance[];
}

export interface VerificationToken {
  identifier: string;
  token: string;
  expires: Date;
  numId: number;
}

export interface Branch {
  id: string;
  numId: number;
  name: string;
  address?: string | null;
  city: string;
  state: string;
  createdAt: Date;
  updatedAt: Date;
  users: User[];
  managers: User[];
  selectedByUsers: User[];
}

export interface Attendance {
  id: string;
  numId: number;
  userId: string;
  date: Date;
  isPresent: boolean;
  checkIn?: string | null;
  checkOut?: string | null;
  isHalfDay: boolean;
  overtime: boolean;
  shift1: boolean;
  shift2: boolean;
  shift3: boolean;
  status: AttendanceStatus;
  verifiedById?: string | null;
  verifiedAt?: Date | null;
  verificationNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: User;
  verifiedBy?: User | null;
}

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
  user: User;
}

export interface Reference {
  id: string;
  name: string;
  contactNo: string;
  userId: string;
  user: User;
  createdAt: Date;
  updatedAt: Date;
}

