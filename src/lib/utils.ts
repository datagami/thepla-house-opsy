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

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
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
