'use client';

// vtu-web/app/admin/transactions/page.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Filter, Download, RefreshCw, ChevronLeft, ChevronRight,
  X, CheckCircle2, XCircle, Clock, AlertTriangle, RotateCcw,
  ArrowUpRight, ArrowDownLeft, Copy, ExternalLink, Loader2,
  Receipt, User, Hash, Calendar, Tag, CreditCard, ChevronDown,
  AlertOctagon, CheckCheck, Undo2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  userId: string;
  _userName?: string;
  type: 'credit' | 'debit';
  category: string;
  amount: number;
  fee: number;
  balanceBefore: number;
  balanceAfter: number;
  status: 'pending' | 'success' | 'failed' | 'reversed' | 'disputed';
  reference: string;
  providerReference: string | null;
  provider: string | null;
  metadata: Record<string, unknown>;
  failureReason: string | null;
  fraudScore: number;
  idempotencyKey: string | null;
  createdAt: { _seconds: number; _nanoseconds: number };
  updatedAt: { _seconds: number; _nanoseconds: number };
}

interface Stats {
  totalVolume: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  total: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'airtime', 'data', 'electricity', 'cable', 'exam_pin', 'sms',
  'wallet_fund', 'withdrawal', 'transfer', 'refund', 'commission',
  'cashback', 'fee', 'internet', 'airtime_to_cash',
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  success: { label: 'Success', color: '#16A34A', bg: '#DCFCE7', icon: CheckCircle2 },
  failed: { label: 'Failed', color: '#DC2626', bg: '#FEE2E2', icon: XCircle },
  pending: { label: 'Pending', color: '#D97706', bg: '#FEF3C7', icon: Clock },
  reversed: { label: 'Reversed', color: '#7C3AED', bg: '#EDE9FE', icon: RotateCcw },
  disputed: { label: 'Disputed', color: '#2563EB', bg: '#DBEAFE', icon: AlertOctagon },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(kobo: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(kobo / 100);
}

function fmtDate(ts: { _seconds: number } | null | undefined) {
  if (!ts) return '—';
  return new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ts._seconds * 1000));
}

function categoryLabel(cat: string) {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const show = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };
  return { toast, show };
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };
  return { copied, copy };
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: '#6B7280', bg: '#F3F4F6', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      <Icon size={10} strokeWidth={2.5} />
      {cfg.label}
    </span>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

interface Filters {
  search: string;
  status: string;
  category: string;
  type: string;
  startDate: string;
  endDate: string;
}

function FilterBar({
  filters,
  onChange,
  onReset,
  loading,
  onRefresh,
}: {
  filters: Filters;
  onChange: (k: keyof Filters, v: string) => void;
  onReset: () => void;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = Object.values(filters).filter(v => v).length;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      {/* Primary row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            type="text"
            placeholder="Reference, provider ref, user ID…"
            value={filters.search}
            onChange={e => onChange('search', e.target.value)}
            className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-4 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </div>

        <select
          value={filters.status}
          onChange={e => onChange('status', e.target.value)}
          className="rounded-xl border border-gray-200 py-2.5 px-3 text-sm focus:border-orange-400 focus:outline-none"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <select
          value={filters.type}
          onChange={e => onChange('type', e.target.value)}
          className="rounded-xl border border-gray-200 py-2.5 px-3 text-sm focus:border-orange-400 focus:outline-none"
        >
          <option value="">All Types</option>
          <option value="debit">Debit</option>
          <option value="credit">Credit</option>
        </select>

        <button
          onClick={() => setExpanded(x => !x)}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-600 hover:border-orange-300 hover:text-orange-600 transition"
        >
          <Filter size={14} />
          More
          {activeCount > 0 && (
            <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{activeCount}</span>
          )}
          <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-600 hover:border-orange-300 hover:text-orange-600 transition disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>

        {activeCount > 0 && (
          <button
            onClick={onReset}
            className="text-sm text-gray-400 hover:text-red-500 transition flex items-center gap-1"
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Expanded row */}
      {expanded && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
          <select
            value={filters.category}
            onChange={e => onChange('category', e.target.value)}
            className="rounded-xl border border-gray-200 py-2.5 px-3 text-sm focus:border-orange-400 focus:outline-none"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{categoryLabel(c)}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500">From</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={e => onChange('startDate', e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500">To</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={e => onChange('endDate', e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stat cards ───────────────────────────────────────────────────────────────

function StatCards({ stats }: { stats: Stats | null }) {
  if (!stats) return null;
  const cards = [
    { label: 'Page Volume', value: fmt(stats.totalVolume), color: '#F97316', bg: '#FFF7ED' },
    { label: 'Successful', value: stats.successCount.toString(), color: '#16A34A', bg: '#F0FDF4' },
    { label: 'Failed', value: stats.failedCount.toString(), color: '#DC2626', bg: '#FEF2F2' },
    { label: 'Pending', value: stats.pendingCount.toString(), color: '#D97706', bg: '#FFFBEB' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map(c => (
        <div
          key={c.label}
          className="rounded-2xl p-4"
          style={{ background: c.bg, border: `1px solid ${c.color}22` }}
        >
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: `${c.color}99` }}>{c.label}</p>
          <p className="mt-1 text-xl font-black" style={{ color: c.color }}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Transaction row ──────────────────────────────────────────────────────────

function TxnRow({ txn, onClick, selected }: { txn: Transaction; onClick: () => void; selected: boolean }) {
  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer border-b border-gray-50 text-sm transition-colors hover:bg-orange-50/50 ${selected ? 'bg-orange-50' : ''}`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: txn.type === 'credit' ? '#DCFCE7' : '#FEE2E2',
              color: txn.type === 'credit' ? '#16A34A' : '#DC2626',
            }}
          >
            {txn.type === 'credit'
              ? <ArrowDownLeft size={13} strokeWidth={2.5} />
              : <ArrowUpRight size={13} strokeWidth={2.5} />
            }
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900 max-w-[140px]">{txn._userName ?? txn.userId}</p>
            <p className="truncate text-[11px] text-gray-400">{txn.reference}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
          {categoryLabel(txn.category)}
        </span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={txn.status} />
      </td>
      <td className="px-4 py-3 text-right font-bold tabular-nums" style={{ color: txn.type === 'credit' ? '#16A34A' : '#111827' }}>
        {txn.type === 'credit' ? '+' : ''}{fmt(txn.amount)}
      </td>
      {txn.fraudScore > 30 && (
        <td className="px-4 py-3">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{
              background: txn.fraudScore > 70 ? '#FEE2E2' : '#FEF3C7',
              color: txn.fraudScore > 70 ? '#DC2626' : '#D97706',
            }}
          >
            ⚠ {txn.fraudScore}
          </span>
        </td>
      )}
      {txn.fraudScore <= 30 && <td className="px-4 py-3" />}
      <td className="px-4 py-3 text-right text-xs text-gray-400 tabular-nums whitespace-nowrap">
        {fmtDate(txn.createdAt)}
      </td>
    </tr>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
  txn,
  onClose,
  onRefund,
  onStatusUpdate,
  loading,
}: {
  txn: Transaction;
  onClose: () => void;
  onRefund: (txnId: string) => void;
  onStatusUpdate: (txnId: string, status: string) => void;
  loading: boolean;
}) {
  const { copied, copy } = useCopy();
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  const canRefund = txn.type === 'debit' && txn.status !== 'reversed' && txn.status !== 'pending';

  function CopyBtn({ text, label }: { text: string; label: string }) {
    return (
      <button
        onClick={() => copy(text, label)}
        className="ml-2 shrink-0 text-gray-300 hover:text-orange-500 transition"
        title="Copy"
      >
        {copied === label ? <CheckCheck size={12} className="text-green-500" /> : <Copy size={12} />}
      </button>
    );
  }

  function Field({ icon: Icon, label, value, mono = false, copyKey }: {
    icon: React.ElementType; label: string; value: React.ReactNode; mono?: boolean; copyKey?: string;
  }) {
    return (
      <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-50">
          <Icon size={13} className="text-gray-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
          <div className={`flex items-center mt-0.5 ${mono ? 'font-mono text-xs' : 'text-sm font-medium text-gray-900'}`}>
            <span className="break-all">{value}</span>
            {copyKey && typeof value === 'string' && <CopyBtn text={value} label={copyKey} />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="font-bold text-gray-900">Transaction Detail</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{txn.reference}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50 transition"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Amount hero */}
          <div
            className="rounded-2xl p-5 text-center"
            style={{
              background: txn.type === 'credit' ? '#F0FDF4' : '#FFF7ED',
              border: `1px solid ${txn.type === 'credit' ? '#86EFAC' : '#FED7AA'}`,
            }}
          >
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: txn.type === 'credit' ? '#16A34A99' : '#F9731699' }}>
              {txn.type === 'debit' ? 'Debit' : 'Credit'}
            </p>
            <p className="mt-1 text-3xl font-black tabular-nums" style={{ color: txn.type === 'credit' ? '#16A34A' : '#EA580C' }}>
              {txn.type === 'credit' ? '+' : ''}{fmt(txn.amount)}
            </p>
            {txn.fee > 0 && (
              <p className="mt-1 text-xs text-gray-400">Platform fee: {fmt(txn.fee)}</p>
            )}
            <div className="mt-3 flex justify-center">
              <StatusBadge status={txn.status} />
            </div>
          </div>

          {/* Fields */}
          <div className="rounded-2xl border border-gray-100 px-4">
            <Field icon={User} label="Account" value={txn._userName ?? txn.userId} copyKey="userId" />
            <Field icon={Tag} label="Category" value={categoryLabel(txn.category)} />
            <Field icon={Hash} label="Reference" value={txn.reference} mono copyKey="ref" />
            {txn.providerReference && (
              <Field icon={ExternalLink} label="Provider Ref" value={txn.providerReference} mono copyKey="provRef" />
            )}
            {txn.provider && (
              <Field icon={CreditCard} label="Provider" value={txn.provider} />
            )}
            <Field icon={Calendar} label="Created" value={fmtDate(txn.createdAt)} />
          </div>

          {/* Balance */}
          <div className="rounded-2xl border border-gray-100 px-4">
            <Field icon={Receipt} label="Balance Before" value={fmt(txn.balanceBefore)} />
            <Field icon={Receipt} label="Balance After" value={fmt(txn.balanceAfter)} />
          </div>

          {/* Fraud score */}
          {txn.fraudScore > 0 && (
            <div
              className="rounded-2xl px-4 py-3"
              style={{
                background: txn.fraudScore > 70 ? '#FEF2F2' : txn.fraudScore > 30 ? '#FFFBEB' : '#F0FDF4',
                border: `1px solid ${txn.fraudScore > 70 ? '#FECACA' : txn.fraudScore > 30 ? '#FDE68A' : '#BBF7D0'}`,
              }}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Fraud Score</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${txn.fraudScore}%`,
                      background: txn.fraudScore > 70 ? '#DC2626' : txn.fraudScore > 30 ? '#D97706' : '#16A34A',
                    }}
                  />
                </div>
                <span className="font-black text-lg tabular-nums" style={{ color: txn.fraudScore > 70 ? '#DC2626' : txn.fraudScore > 30 ? '#D97706' : '#16A34A' }}>
                  {txn.fraudScore}
                </span>
              </div>
            </div>
          )}

          {/* Failure reason */}
          {txn.failureReason && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-red-400">Failure Reason</p>
              <p className="mt-1 text-sm text-red-700">{txn.failureReason}</p>
            </div>
          )}

          {/* Metadata */}
          {Object.keys(txn.metadata ?? {}).length > 0 && (
            <div className="rounded-2xl border border-gray-100 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Metadata</p>
              <div className="space-y-1 font-mono text-xs text-gray-600 max-h-48 overflow-y-auto">
                {Object.entries(txn.metadata).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="shrink-0 text-gray-400">{k}:</span>
                    <span className="break-all">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-gray-100 p-4 space-y-2">
          {/* Status update */}
          <div className="relative">
            <button
              onClick={() => setStatusMenuOpen(o => !o)}
              className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              <span className="flex items-center gap-2">
                <Tag size={14} />
                Update Status
              </span>
              <ChevronDown size={13} className={`transition-transform ${statusMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {statusMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-gray-100 bg-white shadow-xl overflow-hidden z-10">
                {(['success', 'failed', 'reversed', 'disputed'] as const).map(s => {
                  const cfg = STATUS_CONFIG[s];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={s}
                      onClick={() => { onStatusUpdate(txn.id, s); setStatusMenuOpen(false); }}
                      disabled={txn.status === s}
                      className="flex w-full items-center gap-2 px-4 py-3 text-sm hover:bg-gray-50 transition disabled:opacity-40"
                    >
                      <Icon size={13} style={{ color: cfg.color }} />
                      <span style={{ color: cfg.color }} className="font-semibold">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Refund */}
          {canRefund && !showRefundConfirm && (
            <button
              onClick={() => setShowRefundConfirm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-100 transition"
            >
              <Undo2 size={14} />
              Refund {fmt(txn.amount)}
            </button>
          )}

          {showRefundConfirm && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
              <p className="text-xs font-bold text-red-700">Confirm refund of {fmt(txn.amount)} to user?</p>
              <textarea
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
                placeholder="Reason for refund (required)…"
                rows={2}
                className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-300 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRefundConfirm(false)}
                  className="flex-1 rounded-lg border border-red-200 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                >
                  Cancel
                </button>
                <button
                  disabled={refundReason.trim().length < 3 || loading}
                  onClick={() => { onRefund(txn.id); setShowRefundConfirm(false); }}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-bold text-white hover:bg-red-700 transition disabled:opacity-40 flex items-center justify-center gap-1"
                >
                  {loading && <Loader2 size={11} className="animate-spin" />}
                  Confirm Refund
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Bulk Action Bar ──────────────────────────────────────────────────────────

function BulkBar({
  selected,
  onClear,
  onBulkRefund,
  loading,
}: {
  selected: Set<string>;
  onClear: () => void;
  onBulkRefund: () => void;
  loading: boolean;
}) {
  if (selected.size === 0) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-2xl px-5 py-3 shadow-2xl"
      style={{ background: '#111827', color: '#fff' }}
    >
      <span className="text-sm font-semibold">{selected.size} selected</span>
      <button
        onClick={onBulkRefund}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-600 transition disabled:opacity-50"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />}
        Bulk Refund
      </button>
      <button onClick={onClear} className="text-gray-400 hover:text-white transition">
        <X size={15} />
      </button>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toast }: { toast: { msg: string; type: 'ok' | 'err' } | null }) {
  if (!toast) return null;
  return (
    <div
      className="fixed right-5 top-5 z-[999] flex items-center gap-2 rounded-xl px-4 py-3 shadow-xl text-sm font-semibold text-white transition-all"
      style={{ background: toast.type === 'ok' ? '#16A34A' : '#DC2626' }}
    >
      {toast.type === 'ok' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      {toast.msg}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const EMPTY_FILTERS: Filters = { search: '', status: '', category: '', type: '', startDate: '', endDate: '' };

export default function AdminTransactionsPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, hasMore: false });
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerTxn, setDrawerTxn] = useState<Transaction | null>(null);
  const [bulkRefundReason, setBulkRefundReason] = useState('Failed — admin confirmed no service delivery');
  const { toast, show } = useToast();

  const fetchRef = useRef(0);

  const fetchTxns = useCallback(async (page = 1, f = filters) => {
    const id = ++fetchRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (f.search) params.set('search', f.search);
      if (f.status) params.set('status', f.status);
      if (f.category) params.set('category', f.category);
      if (f.type) params.set('type', f.type);
      if (f.startDate) params.set('startDate', new Date(f.startDate).toISOString());
      if (f.endDate) {
        const d = new Date(f.endDate);
        d.setHours(23, 59, 59, 999);
        params.set('endDate', d.toISOString());
      }

      const res = await fetch(`/api/internal/transactions?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load');
      if (id !== fetchRef.current) return;

      setTxns(json.data.transactions);
      setStats(json.data.stats);
      setPagination({ ...json.data.pagination, page });
    } catch (e: any) {
      if (id === fetchRef.current) show(e.message, 'err');
    } finally {
      if (id === fetchRef.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchTxns(1, filters); }, []);

  function handleFilterChange(k: keyof Filters, v: string) {
    const next = { ...filters, [k]: v };
    setFilters(next);
    fetchTxns(1, next);
  }

  function handleReset() {
    setFilters(EMPTY_FILTERS);
    fetchTxns(1, EMPTY_FILTERS);
  }

  function handleRowClick(txn: Transaction) {
    setDrawerTxn(prev => (prev?.id === txn.id ? null : txn));
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === txns.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(txns.map(t => t.id)));
    }
  }

  async function handleRefund(txnId: string) {
    setActionLoading(true);
    try {
      const res = await fetch('/api/internal/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refund', txnId, reason: 'Admin initiated refund' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Refund failed');
      show('Refund processed successfully', 'ok');
      setDrawerTxn(null);
      fetchTxns(pagination.page);
    } catch (e: any) {
      show(e.message, 'err');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBulkRefund() {
    if (!selected.size) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/internal/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_refund',
          txnIds: Array.from(selected),
          reason: bulkRefundReason,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Bulk refund failed');
      show(`${json.data.succeeded}/${selected.size} refunds processed`, 'ok');
      setSelected(new Set());
      fetchTxns(pagination.page);
    } catch (e: any) {
      show(e.message, 'err');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStatusUpdate(txnId: string, status: string) {
    setActionLoading(true);
    try {
      const res = await fetch('/api/internal/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txnId, status, reason: 'Admin manual update' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Update failed');
      show(`Status updated to ${status}`, 'ok');
      // Update in-place
      setTxns(prev => prev.map(t => t.id === txnId ? { ...t, status: status as Transaction['status'] } : t));
      if (drawerTxn?.id === txnId) setDrawerTxn(prev => prev ? { ...prev, status: status as Transaction['status'] } : null);
    } catch (e: any) {
      show(e.message, 'err');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExport() {
    const params = new URLSearchParams({ page: '1', pageSize: '500' });
    if (filters.status) params.set('status', filters.status);
    if (filters.category) params.set('category', filters.category);
    const res = await fetch(`/api/internal/transactions?${params}`);
    const json = await res.json();
    if (!res.ok) { show('Export failed', 'err'); return; }

    const rows = json.data.transactions as Transaction[];
    const header = 'Reference,User,Category,Type,Amount,Fee,Status,Provider,Provider Ref,Date\n';
    const csv = rows.map(t =>
      [
        t.reference,
        t._userName ?? t.userId,
        t.category,
        t.type,
        (t.amount / 100).toFixed(2),
        (t.fee / 100).toFixed(2),
        t.status,
        t.provider ?? '',
        t.providerReference ?? '',
        fmtDate(t.createdAt),
      ].join(',')
    ).join('\n');

    const blob = new Blob([header + csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4 pb-24">
      <Toast toast={toast} />

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900">Transactions</h1>
          <p className="text-sm text-gray-400 mt-0.5">All platform activity, every debit and credit</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:border-orange-300 hover:text-orange-600 transition"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleReset}
        loading={loading}
        onRefresh={() => fetchTxns(pagination.page)}
      />

      <StatCards stats={stats} />

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70">
                <th className="w-8 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === txns.length && txns.length > 0}
                    onChange={toggleAll}
                    className="rounded accent-orange-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Account / Ref</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Category</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Status</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-400">Amount</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Risk</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-400">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && txns.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <Loader2 className="mx-auto animate-spin text-orange-400" size={28} />
                    <p className="mt-3 text-sm text-gray-400">Loading transactions…</p>
                  </td>
                </tr>
              )}
              {!loading && txns.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <Receipt className="mx-auto text-gray-200" size={40} />
                    <p className="mt-3 text-sm font-semibold text-gray-400">No transactions found</p>
                    <p className="text-xs text-gray-300 mt-1">Try adjusting your filters</p>
                  </td>
                </tr>
              )}
              {txns.map(t => (
                <React.Fragment key={t.id}>
                  <tr className="border-b border-gray-50 last:border-0">
                    <td className="w-8 px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(t.id)}
                        onChange={() => toggleSelect(t.id)}
                        className="rounded accent-orange-500"
                      />
                    </td>
                    <TxnRow txn={t} onClick={() => handleRowClick(t)} selected={drawerTxn?.id === t.id} />
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(pagination.hasMore || pagination.page > 1) && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400">Page {pagination.page}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchTxns(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-orange-300 hover:text-orange-600 transition disabled:opacity-30"
              >
                <ChevronLeft size={13} /> Prev
              </button>
              <button
                onClick={() => fetchTxns(pagination.page + 1)}
                disabled={!pagination.hasMore || loading}
                className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-orange-300 hover:text-orange-600 transition disabled:opacity-30"
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      <BulkBar
        selected={selected}
        onClear={() => setSelected(new Set())}
        onBulkRefund={handleBulkRefund}
        loading={actionLoading}
      />

      {/* Detail drawer */}
      {drawerTxn && (
        <DetailDrawer
          txn={drawerTxn}
          onClose={() => setDrawerTxn(null)}
          onRefund={handleRefund}
          onStatusUpdate={handleStatusUpdate}
          loading={actionLoading}
        />
      )}
    </div>
  );
}