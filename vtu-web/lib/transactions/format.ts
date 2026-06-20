// vtu-web/lib/transactions/format.ts
// AGENTS.md RULES: #1 (kobo)
//
// NOTE: AGENTS.md says `lib/utils/formatter.ts` already handles kobo↔NGN and
// date formatting elsewhere in the app. If those exports are accessible and
// match this shape, prefer importing from there instead of this file —
// this only exists so the transactions feature isn't blocked on knowing
// those exact export names.

import type { TransactionCategory } from '@/types';

export function formatNaira(kobo: number): string {
  const naira = (kobo ?? 0) / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(naira);
}

export function signedNaira(kobo: number, type: 'credit' | 'debit'): string {
  const amount = formatNaira(Math.abs(kobo ?? 0));
  return type === 'credit' ? `+${amount}` : `-${amount}`;
}

/** Accepts a Date, ISO string, epoch ms, or a Firestore-Timestamp-shaped object. */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    const seconds = (v.seconds ?? v._seconds) as number | undefined;
    if (typeof seconds === 'number') return new Date(seconds * 1000);
  }
  return null;
}

export function formatDateTime(value: unknown): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateShort(value: unknown): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Category metadata ─────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<string, string> = {
  airtime: 'Airtime',
  data: 'Data',
  electricity: 'Electricity',
  cable: 'Cable TV',
  exam_pin: 'Exam pin',
  sms: 'Bulk SMS',
  wallet_fund: 'Wallet funding',
  withdrawal: 'Withdrawal',
  transfer: 'Transfer',
  bucket_purchase: 'Bucket',
  loan_disbursement: 'Loan disbursed',
  loan_repayment: 'Loan repayment',
  event_ticket: 'Event ticket',
  refund: 'Refund',
  commission: 'Commission',
  cashback: 'Cashback',
  fee: 'Fee',
  internet: 'Internet',
  airtime_to_cash: 'Airtime to cash',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ');
}

export const CATEGORY_OPTIONS: { value: TransactionCategory | string; label: string }[] =
  Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

// ─── Status metadata ───────────────────────────────────────────────────────

export const STATUS_STYLES: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  success: { label: 'Successful', bg: '#ECFDF5', text: '#15803D', dot: '#22C55E' },
  pending: { label: 'Pending', bg: '#FFFBEB', text: '#B45309', dot: '#F59E0B' },
  failed: { label: 'Failed', bg: '#FEF2F2', text: '#B91C1C', dot: '#EF4444' },
  reversed: { label: 'Reversed', bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
  disputed: { label: 'Disputed', bg: '#FAF5FF', text: '#7E22CE', dot: '#A855F7' },
};

export const STATUS_OPTIONS = Object.keys(STATUS_STYLES).map((value) => ({
  value,
  label: STATUS_STYLES[value].label,
}));

export function prettifyKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}