import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines Tailwind classes with clsx and tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats currency values nicely (e.g. ₹150.00 or $150.00)
 */
export function formatCurrency(amount: number, currency = 'INR'): string {
  if (currency === 'INR') {
    return `₹${amount.toFixed(2)}`;
  }
  return `${currency} ${amount.toFixed(2)}`;
}

/**
 * Formats duration in minutes to readable hours & mins
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
