// vtu-web/app/(admin)/fees/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, RefreshCw, Pencil, BarChart2, XCircle, CheckCircle2,
  AlertCircle, TrendingUp, Wallet, Layers, Percent,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeeConfig {
  service: string;
  feeType: 'flat' | 'percentage' | 'none';
  feeValue: number;
  minFeeKobo: number;
  maxFeeKobo: number;
  vatEnabled: boolean;
  vatRate: number;
  isActive: boolean;
}

interface RevenueService {
  service: string;
  txnCount: number;
  totalFeeKobo: number;
}

interface Revenue {
  totalPlatformFeeKobo: number;
  totalVatKobo: number;
  totalFeeRevenueKobo: number;
  byService: RevenueService[];
  periodStart: string;
  periodEnd: string;
}

const SERVICES = [
  'airtime', 'data', 'electricity', 'cable', 'exam_pin',
  'sms', 'wallet_fund', 'withdrawal', 'transfer', '*',
];

const EMPTY_FORM: Omit<FeeConfig, 'isActive'> = {
  service: 'airtime',
  feeType: 'flat',
  feeValue: 0,
  minFeeKobo: 0,
  maxFeeKobo: 0,
  vatEnabled: false,
  vatRate: 0.075,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (k: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(k / 100);

const serviceLabel = (s: string) =>
  s === '*' ? 'All services (default)' : s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// ─── Form Modal ───────────────────────────────────────────────────────────────

function FeeFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: FeeConfig | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    ...(initial ?? { ...EMPTY_FORM, isActive: true }),
    // convert kobo display for flat fee
    feeValueDisplay: initial
      ? initial.feeType === 'flat'
        ? String(initial.feeValue / 100)
        : String(initial.feeValue)
      : '0',
    minFeeDisplay: initial ? String(initial.minFeeKobo / 100) : '0',
    maxFeeDisplay: initial ? String(initial.maxFeeKobo / 100) : '0',
    vatRateDisplay: initial ? String(initial.vatRate * 100) : '7.5',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setError('');
    setSaving(true);
    try {
      const feeValue = form.feeType === 'flat'
        ? Math.round(Number(form.feeValueDisplay) * 100)
        : Number(form.feeValueDisplay);

      const payload = {
        service: form.service,
        feeType: form.feeType,
        feeValue,
        minFeeKobo: Math.round(Number(form.minFeeDisplay) * 100),
        maxFeeKobo: Math.round(Number(form.maxFeeDisplay) * 100),
        vatEnabled: form.vatEnabled,
        vatRate: Number(form.vatRateDisplay) / 100,
        isActive: true,
      };

      const res = await fetch('/api/internal/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl my-4">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="font-semibold text-white">{isEdit ? 'Edit fee config' : 'New fee config'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800">
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
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Service</span>
            <select
              className={inputCls}
              value={form.service}
              onChange={e => set('service', e.target.value)}
              disabled={isEdit}
            >
              {SERVICES.map(s => (
                <option key={s} value={s}>{serviceLabel(s)}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">Fee type</span>
              <select
                className={inputCls}
                value={form.feeType}
                onChange={e => set('feeType', e.target.value)}
              >
                <option value="none">None (free)</option>
                <option value="flat">Flat (₦)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">
                {form.feeType === 'percentage' ? 'Rate (%)' : 'Amount (₦)'}
              </span>
              <input
                type="number"
                min="0"
                step={form.feeType === 'percentage' ? '0.01' : '1'}
                className={inputCls}
                value={form.feeValueDisplay}
                onChange={e => set('feeValueDisplay', e.target.value)}
                disabled={form.feeType === 'none'}
              />
            </label>
          </div>

          {form.feeType === 'percentage' && (
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-400">Min fee (₦, 0 = none)</span>
                <input type="number" min="0" className={inputCls} value={form.minFeeDisplay} onChange={e => set('minFeeDisplay', e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-400">Max fee (₦, 0 = none)</span>
                <input type="number" min="0" className={inputCls} value={form.maxFeeDisplay} onChange={e => set('maxFeeDisplay', e.target.value)} />
              </label>
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">VAT on this service</span>
              <button
                onClick={() => set('vatEnabled', !form.vatEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${form.vatEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${form.vatEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {form.vatEnabled && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-400">VAT rate (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  className={inputCls}
                  value={form.vatRateDisplay}
                  onChange={e => set('vatRateDisplay', e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-500">Standard Nigerian VAT is 7.5%</p>
              </label>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-800 px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create config'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Revenue Panel ────────────────────────────────────────────────────────────

function RevenuePanel() {
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'mtd' | '7d' | '30d'>('mtd');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: string;

      if (range === 'mtd') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      } else if (range === '7d') {
        startDate = new Date(Date.now() - 7 * 86400000).toISOString();
      } else {
        startDate = new Date(Date.now() - 30 * 86400000).toISOString();
      }

      const res = await fetch(`/api/internal/fees?view=revenue&startDate=${startDate}&endDate=${now.toISOString()}`);
      const data = await res.json();
      if (data.success) setRevenue(data.data.revenue);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-200">Fee revenue</h2>
        <div className="flex items-center gap-2">
          {(['mtd', '7d', '30d'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${range === r ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {r === 'mtd' ? 'MTD' : r}
            </button>
          ))}
          <button onClick={load} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
        </div>
      ) : !revenue ? (
        <p className="py-12 text-center text-sm text-slate-500">No revenue data available.</p>
      ) : (
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Platform fees', value: fmt(revenue.totalPlatformFeeKobo), icon: Wallet, color: 'text-indigo-400' },
              { label: 'VAT collected', value: fmt(revenue.totalVatKobo), icon: Percent, color: 'text-amber-400' },
              { label: 'Total revenue', value: fmt(revenue.totalFeeRevenueKobo), icon: TrendingUp, color: 'text-emerald-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <Icon className={`h-4 w-4 ${color}`} />
                <p className="mt-2 text-lg font-bold text-white">{value}</p>
                <p className="mt-0.5 text-xs text-slate-400">{label}</p>
              </div>
            ))}
          </div>

          {revenue.byService.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-400">By service</p>
              <div className="space-y-1.5">
                {revenue.byService.map(s => (
                  <div key={s.service} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2 text-sm">
                    <span className="capitalize text-slate-300">{serviceLabel(s.service)}</span>
                    <div className="text-right">
                      <span className="text-white font-medium">{fmt(s.totalFeeKobo)}</span>
                      <span className="ml-2 text-slate-500 text-xs">{s.txnCount} txns</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function FeesPage() {
  const [configs, setConfigs] = useState<FeeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FeeConfig | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/internal/fees?includeInactive=${includeInactive}`);
      const data = await res.json();
      if (data.success) setConfigs(data.data.configs ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => { load(); }, [load]);

  const deactivate = async (service: string) => {
    if (!confirm(`Deactivate fee config for '${serviceLabel(service)}'? No fees will be charged for this service.`)) return;
    setDeactivating(service);
    await fetch('/api/internal/fees', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service }),
    });
    setDeactivating(null);
    load();
  };

  const feeDisplay = (c: FeeConfig) => {
    if (c.feeType === 'none') return 'Free';
    if (c.feeType === 'flat') return fmt(c.feeValue);
    let s = `${c.feeValue}%`;
    if (c.minFeeKobo > 0) s += ` (min ${fmt(c.minFeeKobo)})`;
    if (c.maxFeeKobo > 0) s += ` (max ${fmt(c.maxFeeKobo)})`;
    return s;
  };

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Transaction Fees</h1>
          <p className="mt-1 text-sm text-slate-400">Configure per-service platform fees and VAT handling.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/10 hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" /> Add fee config
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Fee config table */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-200">Fee configurations</h2>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={e => setIncludeInactive(e.target.checked)}
                  className="rounded"
                />
                Show inactive
              </label>
              <button onClick={load} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <RefreshCw className="h-7 w-7 animate-spin text-indigo-400" />
            </div>
          ) : configs.length === 0 ? (
            <div className="py-16 text-center">
              <Layers className="mx-auto h-10 w-10 text-slate-700" />
              <p className="mt-3 text-sm text-slate-400">No fee configs yet.</p>
              <p className="mt-1 text-xs text-slate-500">All transactions are currently free.</p>
              <button onClick={() => setShowForm(true)} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
                Add first config
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {configs.map(c => (
                <div key={c.service} className={`flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-800/30 ${!c.isActive ? 'opacity-50' : ''}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">{serviceLabel(c.service)}</p>
                      {!c.isActive && (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">Inactive</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-slate-400">
                      <span>Fee: <span className="text-slate-200">{feeDisplay(c)}</span></span>
                      {c.vatEnabled && (
                        <span>VAT: <span className="text-amber-400">{(c.vatRate * 100).toFixed(1)}% on fee</span></span>
                      )}
                    </div>
                  </div>

                  {c.isActive && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => { setEditing(c); setShowForm(true); }}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => deactivate(c.service)}
                        disabled={deactivating === c.service}
                        className="flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                      >
                        {deactivating === c.service
                          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          : <XCircle className="h-3.5 w-3.5" />}
                        Deactivate
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Revenue panel */}
        <RevenuePanel />
      </div>

      {/* Form modal */}
      {showForm && (
        <FeeFormModal
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}