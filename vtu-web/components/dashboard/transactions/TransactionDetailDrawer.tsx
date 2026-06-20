// vtu-web/components/dashboard/transactions/TransactionDetailDrawer.tsx
'use client';

import { useEffect, useState } from 'react';
import { X, Copy, Check, Download, AlertCircle } from 'lucide-react';
import type { Transaction } from '@/types';
import { categoryIcon } from '@/lib/transactions/category-icons';
import {
  categoryLabel,
  formatDateTime,
  formatNaira,
  prettifyKey,
  signedNaira,
} from '@/lib/transactions/format';
import { StatusBadge } from './StatusBadge';

const BRAND = {
  border: '#E5E7EB',
  text: '#111827',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',
  surface: '#F9FAFB',
  orange: '#F97316',
  green: '#22C55E',
};

interface Props {
  transaction: Transaction | null;
  onClose: () => void;
}

export function TransactionDetailDrawer({ transaction, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [transaction?.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!transaction) return null;

  const isCredit = transaction.type === 'credit';
  const isPending = transaction.status === 'pending';
  const Icon = categoryIcon(transaction.category as string);

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(transaction.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — the reference is still visible to copy by hand.
    }
  };

  const metadataEntries = Object.entries(transaction.metadata ?? {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  );

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside
        className="fixed inset-y-0 right-0 z-[91] flex w-full max-w-md flex-col bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Transaction details"
      >
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: BRAND.border }}
        >
          <p className="text-sm font-bold" style={{ color: BRAND.text }}>
            Transaction details
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-[#F9FAFB]"
            style={{ border: `1px solid ${BRAND.border}`, color: BRAND.textMuted }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* Hero amount */}
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(249,115,22,0.1)' }}
            >
              <Icon size={24} style={{ color: BRAND.orange }} strokeWidth={1.8} />
            </div>
            <p className="text-2xl font-bold" style={{ color: isCredit ? BRAND.green : BRAND.text }}>
              {signedNaira(transaction.amount, isCredit ? 'credit' : 'debit')}
            </p>
            <p className="text-sm font-medium" style={{ color: BRAND.textMuted }}>
              {categoryLabel(transaction.category as string)}
            </p>
            <StatusBadge status={transaction.status} />
          </div>

          {transaction.status === 'failed' && transaction.failureReason && (
            <div
              className="mb-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
              style={{ background: '#FEF2F2', color: '#B91C1C' }}
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{transaction.failureReason}</span>
            </div>
          )}

          {/* Reference */}
          <div
            className="mb-4 flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: BRAND.surface }}
          >
            <div className="min-w-0">
              <p className="text-xs" style={{ color: BRAND.textFaint }}>
                Reference
              </p>
              <p className="truncate font-mono text-sm font-medium" style={{ color: BRAND.text }}>
                {transaction.reference}
              </p>
            </div>
            <button
              type="button"
              onClick={copyReference}
              className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-white"
              aria-label="Copy reference"
            >
              {copied ? (
                <Check size={15} style={{ color: BRAND.green }} />
              ) : (
                <Copy size={15} style={{ color: BRAND.textMuted }} />
              )}
            </button>
          </div>

          {/* Core details */}
          <dl className="space-y-3 text-sm">
            <Row label="Date" value={formatDateTime(transaction.createdAt)} />
            {transaction.fee > 0 && <Row label="Fee" value={formatNaira(transaction.fee)} />}
            <Row label="Balance before" value={formatNaira(transaction.balanceBefore)} />
            <Row label="Balance after" value={formatNaira(transaction.balanceAfter)} />
            {transaction.provider && <Row label="Provider" value={transaction.provider} />}
            {transaction.providerReference && (
              <Row label="Provider reference" value={transaction.providerReference} mono />
            )}
          </dl>

          {/* Metadata (phone, meter number, token, etc. — varies by service) */}
          {metadataEntries.length > 0 && (
            <>
              <p
                className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide"
                style={{ color: BRAND.textFaint }}
              >
                More details
              </p>
              <dl className="space-y-3 text-sm">
                {metadataEntries.map(([key, value]) => (
                  <Row key={key} label={prettifyKey(key)} value={String(value)} />
                ))}
              </dl>
            </>
          )}
        </div>

        {/* Footer action */}
        <div className="border-t px-5 py-4" style={{ borderColor: BRAND.border }}>
          {isPending ? (
            <p className="text-center text-xs" style={{ color: BRAND.textFaint }}>
              Receipt will be available once this transaction is confirmed.
            </p>
          ) : (
            <a
              href={`/api/v1/transactions/${transaction.reference}/receipt`}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}
            >
              <Download size={16} />
              Download receipt
            </a>
          )}
        </div>
      </aside>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt style={{ color: BRAND.textMuted }}>{label}</dt>
      <dd className={`text-right font-medium ${mono ? 'font-mono' : ''}`} style={{ color: BRAND.text }}>
        {value}
      </dd>
    </div>
  );
}