import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

/**
 * Deterministic date-only formatting for SSR/CSR consistency.
 *
 * Using the runtime's default locale can cause hydration mismatches
 * (e.g. `23/8/2025` vs `8/23/2025`) when server and client locales differ.
 */
export function formatDateOnly(
  date: Date | string | number | null | undefined,
  opts?: { locale?: string; timeZone?: string }
): string {
  if (!date) return "";

  const locale = opts?.locale ?? "en-GB"; // common dd/mm/yyyy ordering
  const timeZone = opts?.timeZone ?? "Asia/Kolkata";

  const baseOptions: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  };

  try {
    return new Intl.DateTimeFormat(locale, {
      ...baseOptions,
      timeZone,
    }).format(new Date(date));
  } catch {
    // Fallback if the runtime doesn't support the provided timeZone.
    return new Intl.DateTimeFormat(locale, baseOptions).format(new Date(date));
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Hash a string into a hue value [0, 360). Used to give each person/department
 * a stable color (e.g. for avatar fallback backgrounds, department pills).
 */
export function stringToHue(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

/**
 * Extract up to two initials from a person's name:
 * first letter of first token + first letter of last token, uppercased.
 * Returns "?" for null/empty input.
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '?';
  if (tokens.length === 1) return tokens[0].charAt(0).toUpperCase();
  const first = tokens[0].charAt(0);
  const last = tokens[tokens.length - 1].charAt(0);
  return (first + last).toUpperCase();
}

/**
 * Generates a predictable password: first 3 letters of name + special symbol + 4 random digits
 * Format: abc@1234
 */
export function generatePassword(userName: string | null | undefined): string {
  // Get first 3 letters of name, convert to lowercase
  // If name is shorter than 3 characters, pad with 'x' or use what's available
  let namePart = "";
  if (userName && userName.length > 0) {
    // Remove spaces and take first 3 characters
    const cleanedName = userName.replace(/\s+/g, "").toLowerCase();
    namePart = cleanedName.substring(0, 3);
    // Pad with 'x' if name is shorter than 3 characters
    while (namePart.length < 3) {
      namePart += "x";
    }
  } else {
    // Fallback if no name
    namePart = "usr";
  }

  // Special symbol
  const specialSymbol = "@";

  // Generate 4 random digits
  const randomDigits = Math.floor(1000 + Math.random() * 9000).toString();

  return namePart + specialSymbol + randomDigits;
}
