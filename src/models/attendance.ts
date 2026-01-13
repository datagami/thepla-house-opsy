import {Attendance} from "@/models/models";


export interface AttendanceFormProps {
  userId?: string;
  userName?: string | null;
  date?: Date;
  currentAttendance?: Attendance;
  isOpen?: boolean;
  onCloseAction: () => void;
  userRole?: string;
  onSubmit?: (data: Attendance) => void;
  defaultValues?: Attendance;
  isLoading?: boolean;
  isHR?: boolean;
  department: string;
}

export interface AttendanceFormData {
  userId?: string | null;
  date: Date;
  isPresent: boolean;
  checkIn?: string | null;
  checkOut?: string | null;
  isHalfDay: boolean;
  overtime: boolean;
  isWeeklyOff?: boolean;
  shift1: boolean;
  shift2: boolean;
  shift3: boolean;
  notes?: string | null;
  status: string;
  verificationNote?: string | null;
  verifiedById?: string | null;
  verifiedAt?: Date | null;
} 
