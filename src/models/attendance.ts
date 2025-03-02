import {Attendance} from "@/models/models";


export interface AttendanceFormProps {
  userId: string;
  userName: string;
  date: Date;
  currentAttendance?: Attendance;
  isOpen: boolean;
  onClose: () => void;
  userRole: string;
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
