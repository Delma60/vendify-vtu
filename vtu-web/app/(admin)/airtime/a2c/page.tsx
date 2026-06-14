// vtu-web/app/(admin)/airtime/a2c/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle,
  Pencil, TrendingDown, Wallet, Layers, Users,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Network = 'mtn' | 'airtel' | 'glo' | '9mobile';
type A2CStatus = 'pending' | 'approved' | 'rejected' | 'credited';

interface A2CRate {
  network: Network;
  ratePercent: number;
  minAmountKobo: number;
  maxAmountKobo: number;
  isActive: boolean;
}

interface A2CRequest {
  id: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  network: Network;
  phone: string;
  faceValueKobo: number;
  payoutKobo: number;
  ratePercent: number;
  status: A2CStatus;
  adminNote: string | null;
  createdAt: { _seconds: number };
}

const NETWORKS: Network[] = ['mtn', 'airtel', 'glo', '9mobile'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (k: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(k / 100);

const fmtDate = (s: number) =>
  new Date(s * 1000).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const NETWORK_COLORS: Record<Network, string> = {
  mtn: 'bg-yellow-500/15 text-yellow-400',
  airtel: 'bg-red-500/15 text-red-400',
  glo: 'bg-green-500/15 text-green-400',
  '9mobile': 'bg-emerald-500/15 text-emerald-400',
};

// ─── Rate Edit Modal ──────────────────────────────────────────────────────────

function RateEditModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: A2CRate | { network: Network };
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = 'ratePercent' in initial ? initial : null;
  const [form, setForm] = useState({
    ratePercent: String(existing?.ratePercent ?? 75),
    minAmountNaira: String(existing ? existing.minAmountKobo / 100 : 100),
    maxAmountNaira: String(existing && existing.maxAmountKobo > 0 ? existing.maxAmountKobo / 100 : 0),
    isActive: existing?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/internal/airtime/a2c', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network: initial.network,
          ratePercent: Number(form.ratePercent),
          minAmountNaira: Number(form.minAmountNaira),
          maxAmountNaira: Number(form.maxAmountNaira),
          isActive: form.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="font-semibold text-white">
            {initial.network.toUpperCase()} Rate Config
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Payout rate (%)</span>
            <input
              type="number" min="1" max="100" step="0.5"
              className={inputCls}
              value={form.ratePercent}
              onChange={e => setForm(f => ({ ...f, ratePercent: e.target.value }))}
            />
            <p className="mt-1 text-xs text-slate-500">
              User receives this % of airtime face value. e.g. 75 → user sends ₦1,000 airtime, gets ₦750.
            </p>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">Min amount (₦)</span>
              <input type="number" min="0" className={inputCls} value={form.minAmountNaira}
                onChange={e => setForm(f => ({ ...f, minAmountNaira: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">Max amount (₦, 0 = unlimited)</span>
              <input type="number" min="0" className={inputCls} value={form.maxAmountNaira}
                onChange={e => setForm(f => ({ ...f, maxAmountNaira: e.target.value }))} />
            </label>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <span className="text-sm font-medium text-slate-300">Active (accepting requests)</span>
            <button
              onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${form.isActive ? 'bg-indigo-600' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-800 px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
            Save rate
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function A2CAdminPage() {
  const [tab, setTab] = useState<'requests' | 'rates'>('requests');
  const [requests, setRequests] = useState<A2CRequest[]>([]);
  const [rates, setRates] = useState<A2CRate[]>([]);
  const [summary, setSummary] = useState({ pending: 0, total: 0 });
  const [statusFilter, setStatusFilter] = useState<A2CStatus | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [editingRate, setEditingRate] = useState<A2CRate | { network: Network } | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [noteModal, setNoteModal] = useState<{ requestId: string; action: 'approve' | 'reject' } | null>(null);
  const [adminNote, setAdminNote] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/internal/airtime/a2c${params}`);
      const data = await res.json();
      if (data.success) {
        setRequests(data.data.requests ?? []);
        setSummary(data.data.summary ?? { pending: 0, total: 0 });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [statusFilter]);

  const loadRates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/internal/airtime/a2c?view=rates');
      const data = await res.json();
      if (data.success) setRates(data.data.rates ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'requests') loadRequests();
    else loadRates();
  }, [tab, loadRequests, loadRates]);

  const handleProcess = async (requestId: string, action: 'approve' | 'reject') => {
    setNoteModal({ requestId, action });
  };

  const confirmProcess = async () => {
    if (!noteModal) return;
    setProcessing(noteModal.requestId);
    try {
      await fetch('/api/internal/airtime/a2c', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: noteModal.requestId, action: noteModal.action, adminNote }),
      });
      setNoteModal(null);
      setAdminNote('');
      loadRequests();
    } finally {
      setProcessing(null);
    }
  };

  const getRateForNetwork = (network: Network) => rates.find(r => r.network === network);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Airtime to Cash</h1>
        <p className="mt-1 text-sm text-slate-400">Manage A2C conversion rates and process user requests.</p>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Pending requests', value: summary.pending, icon: Clock, color: 'text-amber-400' },
          { label: 'Total requests', value: summary.total, icon: Layers, color: 'text-indigo-400' },
          { label: 'Active networks', value: rates.filter(r => r.isActive).length, icon: TrendingDown, color: 'text-emerald-400' },
          { label: 'Avg payout rate', value: rates.length ? `${(rates.reduce((s, r) => s + r.ratePercent, 0) / rates.length).toFixed(0)}%` : '—', icon: Wallet, color: 'text-blue-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <Icon className={`h-5 w-5 ${color}`} />
            <p className="mt-3 text-xl font-bold text-white">{value}</p>
            <p className="mt-0.5 text-xs text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-slate-800 bg-slate-900/50 p-1 w-fit">
        {(['requests', 'rates'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {t === 'requests' ? 'Request Queue' : 'Rate Config'}
          </button>
        ))}
      </div>

      {/* ── REQUESTS TAB ── */}
      {tab === 'requests' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
            <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-950 p-0.5">
              {(['all', 'pending', 'credited', 'rejected'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition ${statusFilter === s ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <button onClick={loadRequests} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><RefreshCw className="h-7 w-7 animate-spin text-indigo-400" /></div>
          ) : requests.length === 0 ? (
            <div className="py-16 text-center">
              <Clock className="mx-auto h-10 w-10 text-slate-700" />
              <p className="mt-3 text-sm text-slate-400">No requests found.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {requests.map(r => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 hover:bg-slate-800/30 transition">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-white">{r.userDisplayName}</p>
                      <span className="text-xs text-slate-500">{r.userEmail}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${NETWORK_COLORS[r.network]}`}>
                        {r.network.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-slate-400">
                      <span>Phone: {r.phone}</span>
                      <span>Face value: <span className="text-white">{fmt(r.faceValueKobo)}</span></span>
                      <span>Payout: <span className="text-emerald-400 font-medium">{fmt(r.payoutKobo)}</span></span>
                      <span>Rate: {r.ratePercent}%</span>
                      <span>{fmtDate(r.createdAt._seconds)}</span>
                    </div>
                    {r.adminNote && (
                      <p className="mt-1 text-xs text-slate-500 italic">Note: {r.adminNote}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {r.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleProcess(r.id, 'approve')}
                          disabled={processing === r.id}
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleProcess(r.id, 'reject')}
                          disabled={processing === r.id}
                          className="flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </>
                    )}
                    {r.status !== 'pending' && (
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${r.status === 'credited' ? 'bg-emerald-500/15 text-emerald-400' : r.status === 'rejected' ? 'bg-red-500/15 text-red-400' : 'bg-slate-700 text-slate-300'}`}>
                        {r.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── RATES TAB ── */}
      {tab === 'rates' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-200">Network payout rates</h2>
            <button onClick={loadRates} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="divide-y divide-slate-800/60">
            {NETWORKS.map(network => {
              const rate = getRateForNetwork(network);
              return (
                <div key={network} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-800/30 transition">
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${NETWORK_COLORS[network]}`}>
                      {network.toUpperCase()}
                    </span>
                    {rate ? (
                      <div className="text-sm">
                        <span className="text-white font-medium">{rate.ratePercent}% payout rate</span>
                        <span className="ml-2 text-slate-400">
                          Min: {fmt(rate.minAmountKobo)}
                          {rate.maxAmountKobo > 0 ? ` · Max: ${fmt(rate.maxAmountKobo)}` : ' · No max'}
                        </span>
                        {!rate.isActive && (
                          <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">Inactive</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500">No rate configured — service disabled</span>
                    )}
                  </div>
                  <button
                    onClick={() => setEditingRate(rate ?? { network })}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {rate ? 'Edit' : 'Configure'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin note / confirm modal */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h2 className="font-semibold text-white capitalize">{noteModal.action} request</h2>
              <button onClick={() => { setNoteModal(null); setAdminNote(''); }} className="text-slate-400 hover:text-white">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-400">
                  Admin note (optional{noteModal.action === 'reject' ? ', shown to user' : ''})
                </span>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500"
                  placeholder={noteModal.action === 'reject' ? 'Reason for rejection...' : 'Optional note for records...'}
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-800 px-6 py-4">
              <button onClick={() => { setNoteModal(null); setAdminNote(''); }} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
                Cancel
              </button>
              <button
                onClick={confirmProcess}
                disabled={!!processing}
                className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 ${noteModal.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}
              >
                {processing && <RefreshCw className="h-4 w-4 animate-spin" />}
                Confirm {noteModal.action}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rate edit modal */}
      {editingRate && (
        <RateEditModal
          initial={editingRate}
          onClose={() => setEditingRate(null)}
          onSaved={() => { setEditingRate(null); loadRates(); }}
        />
      )}
    </div>
  );
}