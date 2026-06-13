// vtu-web/lib/utils/formatter.ts

/**
 * Convert kobo (integer) to NGN display string.
 * @example koboToNaira(150000) => "₦1,500.00"
 */
export function koboToNaira(kobo: number): string {
  const naira = kobo / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(naira);
}

/**
 * Convert NGN amount to kobo integer. Never use parseFloat on money.
 * @example nairaToKobo(1500) => 150000
 */
export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

/**
 * Safe kobo addition — avoids floating point drift.
 */
export function addKobo(a: number, b: number): number {
  return Math.round(a + b);
}

/**
 * Format a date timestamp for display.
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/**
 * Format kobo as a plain number string: "1500.00"
 */
export function koboToNairaRaw(kobo: number): string {
  return (kobo / 100).toFixed(2);
}