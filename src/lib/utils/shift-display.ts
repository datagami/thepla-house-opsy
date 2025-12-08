/**
 * Converts shift boolean values to time-based descriptions
 * @param shift1 - Morning shift (7 AM to 11 AM)
 * @param shift2 - Afternoon shift (11 AM to 7 PM)
 * @param shift3 - Night shift (7 PM to 11 PM)
 * @returns Formatted time description string
 */
export function getShiftDisplay(shift1: boolean, shift2: boolean, shift3: boolean): string {
  // Special case: Break shift (shift1 + shift3) - non-contiguous, with compact timings
  if (shift1 && !shift2 && shift3) {
    return "Break shift (7-11 AM & 7-11 PM)";
  }

  // Special case: All three shifts (shift1 + shift2 + shift3) - contiguous, merge to 7 AM to 11 PM
  if (shift1 && shift2 && shift3) {
    return "7 AM to 11 PM";
  }

  // Special case: Combined shift (shift2 + shift3) - contiguous, merge to 11 AM to 11 PM
  if (!shift1 && shift2 && shift3) {
    return "11 AM to 11 PM";
  }

  // Special case: shift1 + shift2 - contiguous, merge to 7 AM to 7 PM
  if (shift1 && shift2 && !shift3) {
    return "7 AM to 7 PM";
  }

  // Individual shifts
  if (shift1 && !shift2 && !shift3) {
    return "7 AM to 11 AM";
  }
  if (!shift1 && shift2 && !shift3) {
    return "11 AM to 7 PM";
  }
  if (!shift1 && !shift2 && shift3) {
    return "7 PM to 11 PM";
  }

  // No shifts selected
  return "-";
}
