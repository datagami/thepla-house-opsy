export type AttendanceStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

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
  status: string;
  verifiedById?: string | null;
  verifiedAt?: Date | null;
  verificationNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendanceFormProps {
  userId: string;
  userName: string;
  date: Date;
  currentAttendance?: Attendance;
  isOpen: boolean;
  onClose: () => void;
  userRole: string;
}

export interface AttendanceVerificationData {
  status: AttendanceStatus;
  verifiedById: string | null;
  verifiedAt: Date | null;
  verificationNote: string | null;
}

export interface AttendanceFormData {
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
  status: string;
  verificationNote?: string | null;
  verifiedById?: string | null;
  verifiedAt?: Date | null;
} 