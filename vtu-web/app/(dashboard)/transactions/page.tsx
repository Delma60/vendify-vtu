// vtu-web/app/(dashboard)/transactions/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, AlertCircle, X } from 'lucide-react';
import type { Transaction } from '@/types';
import {
  TransactionFilters,
  EMPTY_TRANSACTION_FILTERS,
  type TransactionFiltersValue,
} from '@/components/dashboard/transactions/TransactionFilters';
import { TransactionsTable } from '@/components/dashboard/transactions/TransactionsTable';
import { TransactionDetailDrawer } from '@/components/dashboard/transactions/TransactionDetailDrawer';

const BRAND = {
  border: '#E5E7EB',
  text: '#111827',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',
};

const PAGE_SIZE = 20;

interface ListState {
  transactions: Transaction[];
  page: number;
  hasMore: boolean;
}

export default function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFiltersValue>(EMPTY_TRANSACTION_FILTERS);
  const [page, setPage] = useState(1);
  const [list, setList] = useState<ListState>({ transactions: [], page: 1, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);

  const [lookupValue, setLookupValue] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (targetPage: number, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters.category) params.set('category', filters.category);
        if (filters.status) params.set('status', filters.status);
        if (filters.startDate) {
          params.set('startDate', new Date(`${filters.startDate}T00:00:00`).toISOString());
        }
        if (filters.endDate) {
          params.set('endDate', new Date(`${filters.endDate}T23:59:59`).toISOString());
        }
        params.set('page', String(targetPage));
        params.set('pageSize', String(PAGE_SIZE));

        const res = await fetch(`/api/v1/transactions?${params.toString()}`, { signal });
        const json = await res.json();

        if (!res.ok || json.success === false) {
          throw new Error(json?.error ?? 'Could not load transactions. Please try again.');
        }

        setList({
          transactions: json.data.transactions,
          page: json.data.pagination.page,
          hasMore: json.data.pagination.hasMore,
        });
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setError(e?.message ?? 'Could not load transactions. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  // Filters changed → reset to page 1 and fetch fresh results.
  useEffect(() => {
    const controller = new AbortController();
    setPage(1);
    fetchPage(1, controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Page changed via Previous/Next (the filters effect above already covers page 1).
  useEffect(() => {
    if (page === 1) return;
    const controller = new AbortController();
    fetchPage(page, controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const lookupReference = async () => {
    const ref = lookupValue.trim();
    if (!ref) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await fetch(`/api/v1/transactions/${encodeURIComponent(ref)}`);
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(
          res.status === 404
            ? 'No transaction found with that reference.'
            : json?.error ?? 'Lookup failed. Please try again.'
        );
      }
      setSelected(json.data);
    } catch (e: any) {
      setLookupError(e?.message ?? 'Lookup failed. Please try again.');
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-lg font-bold" style={{ color: BRAND.text }}>
          Transaction history
        </h1>
        <p className="text-sm" style={{ color: BRAND.textMuted }}>
          Every airtime, data, bill, and wallet transaction on your account.
        </p>
      </div>

      {/* Quick reference lookup */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: BRAND.textFaint }}
          />
          <input
            value={lookupValue}
            onChange={(e) => setLookupValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookupReference()}
            placeholder="Find a transaction by reference (e.g. VTX-AIR-…)"
            className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#F97316]"
            style={{ borderColor: BRAND.border, color: BRAND.text }}
          />
        </div>
        <button
          type="button"
          onClick={lookupReference}
          disabled={lookupLoading || !lookupValue.trim()}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}
        >
          {lookupLoading ? 'Searching…' : 'Find'}
        </button>
      </div>
      {lookupError && (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
          style={{ background: '#FEF2F2', color: '#B91C1C' }}
        >
          <AlertCircle size={13} />
          {lookupError}
          <button type="button" onClick={() => setLookupError(null)} className="ml-auto" aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Filters */}
      <TransactionFilters value={filters} onChange={setFilters} />

      {/* Error banner */}
      {error && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: '#FEF2F2', color: '#B91C1C' }}
        >
          <span className="flex items-center gap-2">
            <AlertCircle size={15} />
            {error}
          </span>
          <button type="button" onClick={() => fetchPage(page)} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {/* List */}
      <TransactionsTable transactions={list.transactions} loading={loading} onSelect={setSelected} />

      {/* Pagination */}
      {!loading && (list.transactions.length > 0 || page > 1) && (
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-40"
            style={{ borderColor: BRAND.border, color: BRAND.text }}
          >
            Previous
          </button>
          <span className="text-xs" style={{ color: BRAND.textFaint }}>
            Page {page}
          </span>
          <button
            type="button"
            disabled={!list.hasMore}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-40"
            style={{ borderColor: BRAND.border, color: BRAND.text }}
          >
            Next
          </button>
        </div>
      )}

      <TransactionDetailDrawer transaction={selected} onClose={() => setSelected(null)} />
    </div>
  );
}