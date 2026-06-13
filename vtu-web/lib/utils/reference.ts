// vtu-web/lib/utils/reference.ts
import { randomBytes } from 'crypto';

const SERVICE_CODES: Record<string, string> = {
  airtime: 'AIR',
  data: 'DAT',
  electricity: 'ELE',
  cable: 'CAB',
  exam_pin: 'PIN',
  sms: 'SMS',
  wallet_fund: 'FND',
  withdrawal: 'WDR',
  transfer: 'TRF',
  bucket_purchase: 'BKT',
  loan_disbursement: 'LNS',
  loan_repayment: 'LNS',
  refund: 'RFD',
  commission: 'COM',
  cashback: 'CBK',
};

/**
 * Generates a unique transaction reference.
 * Format: VTX-{SERVICE_CODE}-{TIMESTAMP_MS}-{RANDOM_6}
 *
 * @example VTX-AIR-1718271234567-A7F3K2
 */
export function generateReference(category: string): string {
  const code = SERVICE_CODES[category] ?? 'TXN';
  const timestamp = Date.now();
  const random = randomBytes(3).toString('hex').toUpperCase();
  return `VTX-${code}-${timestamp}-${random}`;
}

/**
 * Generate a short idempotency-safe reference for webhook deduplication.
 */
export function generateWebhookId(): string {
  return `WH-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}