type UserRole = "EMPLOYEE" | "BRANCH_MANAGER" | "HR" | "MANAGEMENT";

type UserStatus = "PENDING" | "ACTIVE" | "INACTIVE";

type LeaveType = "CASUAL" | "SICK" | "ANNUAL" | "UNPAID" | "OTHER";

type AttendanceStatus = "PENDING_VERIFICATION" | "APPROVED" | "REJECTED";

type SalaryStatus = "PENDING" | "PROCESSING" | "PAID" | "FAILED";

type AdvanceStatus = "PENDING" | "APPROVED" | "REJECTED" | "SETTLED";

type InstallmentStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

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
  isActive: boolean;
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
  totalAdvanceBalance: number;
  totalEmiDeduction: number;
  references: Reference[];
  bankAccountNo?: string | null;
  bankIfscCode?: string | null;
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
  salaries: Salary[];
  advances: AdvancePayment[];
  approvedAdvances: AdvancePayment[];
  approvedInstallments: AdvancePaymentInstallment[];
  uploadedBranchDocuments: BranchDocument[];
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
  attendances: Attendance[];
  documents: BranchDocument[];
}

export interface DocumentType {
  id: string;
  numId: number;
  name: string;
  description?: string | null;
  mandatory: boolean;
  createdAt: Date;
  updatedAt: Date;
  documents: BranchDocument[];
}

export interface BranchDocument {
  id: string;
  numId: number;
  name: string;
  description?: string | null;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  renewalDate: Date;
  reminderDate: Date;
  uploadedById: string;
  branchId: string;
  documentTypeId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  uploadedBy: User;
  branch: Branch;
  documentType?: DocumentType | null;
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
  branchId: string;
  branch: Branch;
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

export interface Salary {
  id: string;
  numId: number;
  userId: string;
  month: number;
  year: number;
  baseSalary: number;
  advanceDeduction: number;
  deductions: number;
  overtimeBonus: number;
  otherBonuses: number;
  otherDeductions: number;
  netSalary: number;
  presentDays: number;
  overtimeDays: number;
  halfDays: number;
  leavesEarned: number;
  leaveSalary: number;
  status: SalaryStatus;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: User;
  installments: AdvancePaymentInstallment[];
}

export interface AdvancePayment {
  id: string;
  numId: number;
  userId: string;
  amount: number;
  emiAmount: number;
  remainingAmount: number;
  reason?: string | null;
  status: AdvanceStatus;
  isSettled: boolean;
  approvedById?: string | null;
  approvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: User;
  approvedBy?: User | null;
  installments: AdvancePaymentInstallment[];
}

export interface AdvancePaymentInstallment {
  id: string;
  numId: number;
  advanceId: string;
  salaryId: string;
  userId: string;
  amountPaid: number;
  status: InstallmentStatus;
  approvedById?: string | null;
  approvedAt?: Date | null;
  paidAt?: Date | null;
  advance: AdvancePayment;
  salary: Salary;
  approvedBy?: User | null;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  ownerId: string;
  isArchived: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner: User;
  sharedWith: NoteShare[];
  comments: NoteComment[];
  editHistory: NoteEditHistory[];
}

export interface NoteShare {
  id: string;
  noteId: string;
  userId: string;
  note: Note;
  user: User;
}

export interface NoteComment {
  id: string;
  noteId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  note: Note;
  author: User;
}

export interface NoteEditHistory {
  id: string;
  noteId: string;
  editorId: string;
  content: string;
  editedAt: Date;
  note: Note;
  editor: User;
}
