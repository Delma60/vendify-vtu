// vtu-web/components/dashboard/transactions/TransactionsTable.tsx
'use client';

import { ChevronRight, ReceiptText } from 'lucide-react';
import type { Transaction } from '@/types';
import { categoryIcon } from '@/lib/transactions/category-icons';
import { categoryLabel, formatDateShort, signedNaira } from '@/lib/transactions/format';
import { StatusBadge } from './StatusBadge';

const BRAND = {
  border: '#E5E7EB',
  text: '#111827',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',
  surface: '#F9FAFB',
  green: '#22C55E',
};

interface Props {
  transactions: Transaction[];
  loading: boolean;
  onSelect: (txn: Transaction) => void;
}

export function TransactionsTable({ transactions, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="divide-y overflow-hidden rounded-2xl border" style={{ borderColor: BRAND.border }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl" style={{ background: BRAND.surface }} />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 animate-pulse rounded" style={{ background: BRAND.surface }} />
              <div className="h-3 w-1/4 animate-pulse rounded" style={{ background: BRAND.surface }} />
            </div>
            <div className="h-3 w-16 animate-pulse rounded" style={{ background: BRAND.surface }} />
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border px-6 py-16 text-center"
        style={{ borderColor: BRAND.border, background: '#fff' }}
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: BRAND.surface }}
        >
          <ReceiptText size={20} style={{ color: BRAND.textFaint }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: BRAND.text }}>
          No transactions found
        </p>
        <p className="max-w-xs text-sm" style={{ color: BRAND.textMuted }}>
          Nothing matches your current filters. Try widening the date range or clearing filters.
        </p>
      </div>
    );
  }

  return (
    <div
      className="divide-y overflow-hidden rounded-2xl border"
      style={{ borderColor: BRAND.border, background: '#fff' }}
    >
      {transactions.map((txn) => {
        const Icon = categoryIcon(txn.category as string);
        const isCredit = txn.type === 'credit';

        return (
          <button
            key={txn.id}
            type="button"
            onClick={() => onSelect(txn)}
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-[#FFF7ED]"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'rgba(249,115,22,0.1)' }}
            >
              <Icon size={18} style={{ color: '#F97316' }} strokeWidth={1.8} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold" style={{ color: BRAND.text }}>
                {categoryLabel(txn.category as string)}
              </p>
              <p className="truncate text-xs" style={{ color: BRAND.textMuted }}>
                {txn.reference} · {formatDateShort(txn.createdAt)}
              </p>
            </div>

            <div className="hidden sm:block">
              <StatusBadge status={txn.status} />
            </div>

            <div className="text-right">
              <p
                className="text-sm font-bold whitespace-nowrap"
                style={{ color: isCredit ? BRAND.green : BRAND.text }}
              >
                {signedNaira(txn.amount, isCredit ? 'credit' : 'debit')}
              </p>
              <div className="mt-1 sm:hidden">
                <StatusBadge status={txn.status} />
              </div>
            </div>

            <ChevronRight size={16} className="hidden shrink-0 sm:block" style={{ color: BRAND.textFaint }} />
          </button>
        );
      })}
    </div>
  );
}