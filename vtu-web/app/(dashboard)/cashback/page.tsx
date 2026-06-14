// vtu-web/app/(dashboard)/cashback/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Gift, TrendingUp, Wallet, ChevronRight, ChevronLeft, Tag } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CashbackRecord {
  id: string;
  campaignId: string;
  service: string;
  transactionAmountKobo: number;
  cashbackAmountKobo: number;
  status: string;
  creditedAt?: { _seconds: number } | null;
  createdAt: { _seconds: number };
}

interface Summary {
  lifetimeTotalKobo: number;
  recordCount: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (k: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(k / 100);

const fmtDate = (s: number) =>
  new Date(s * 1000).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const serviceLabel = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const SERVICE_COLORS: Record<string, string> = {
  airtime: 'bg-blue-500/15 text-blue-400',
  data: 'bg-indigo-500/15 text-indigo-400',
  electricity: 'bg-amber-500/15 text-amber-400',
  cable: 'bg-purple-500/15 text-purple-400',
  exam_pin: 'bg-teal-500/15 text-teal-400',
  sms: 'bg-pink-500/15 text-pink-400',
};

const serviceColor = (s: string) => SERVICE_COLORS[s] ?? 'bg-slate-700 text-slate-300';

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function CashbackPage() {
  const [records, setRecords] = useState<CashbackRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, hasMore: false });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/cashback?page=${p}&pageSize=20`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.data.records ?? []);
        setSummary(data.data.summary ?? null);
        setPagination(data.data.pagination ?? { page: p, pageSize: 20, hasMore: false });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  const goPage = (n: number) => { setPage(n); load(n); };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Cashback</h1>
        <p className="mt-1 text-sm text-slate-400">Rewards you've earned from active campaigns.</p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="col-span-2 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/60 to-slate-900/60 p-6 sm:col-span-1">
            <Gift className="h-6 w-6 text-indigo-400" />
            <p className="mt-4 text-3xl font-extrabold tracking-tight text-white">
              {fmt(summary.lifetimeTotalKobo)}
            </p>
            <p className="mt-1 text-sm text-slate-400">Total cashback earned</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <p className="mt-3 text-xl font-bold text-white">{summary.recordCount}</p>
            <p className="mt-0.5 text-xs text-slate-400">Total rewards</p>
          </div>
          {summary.recordCount > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <Wallet className="h-5 w-5 text-amber-400" />
              <p className="mt-3 text-xl font-bold text-white">
                {fmt(Math.round(summary.lifetimeTotalKobo / summary.recordCount))}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">Average reward</p>
            </div>
          )}
        </div>
      )}

      {/* Records */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-200">Reward history</h2>
          <button onClick={() => load(page)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="h-7 w-7 animate-spin text-indigo-400" />
          </div>
        ) : records.length === 0 ? (
          <div className="py-16 text-center">
            <Gift className="mx-auto h-10 w-10 text-slate-700" />
            <p className="mt-3 text-sm text-slate-400">No cashback earned yet.</p>
            <p className="mt-1 text-xs text-slate-500">Make a qualifying transaction to earn your first reward.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {records.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-800/30 transition">
                <div className="flex items-center gap-4 min-w-0">
                  {/* Service icon */}
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${serviceColor(r.service)}`}>
                    {r.service.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-white">{serviceLabel(r.service)} cashback</p>
                      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-300">
                        <Tag className="h-3 w-3" />
                        {r.campaignId.slice(0, 8)}…
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>On {fmt(r.transactionAmountKobo)} transaction</span>
                      {r.creditedAt && <span>{fmtDate(r.creditedAt._seconds)}</span>}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-emerald-400">+{fmt(r.cashbackAmountKobo)}</p>
                  <p className="mt-0.5 text-xs text-slate-500 capitalize">{r.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {(page > 1 || pagination.hasMore) && (
          <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
            <button
              onClick={() => goPage(page - 1)}
              disabled={page <= 1}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <span className="text-xs text-slate-500">Page {page}</span>
            <button
              onClick={() => goPage(page + 1)}
              disabled={!pagination.hasMore}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-30"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}