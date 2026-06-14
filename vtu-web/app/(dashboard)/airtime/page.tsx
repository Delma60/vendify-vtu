// vtu-web/app/(dashboard)/airtime/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Smartphone, Upload, RefreshCw, TrendingDown, Settings2,
  Plus, Trash2, AlertCircle, CheckCircle2, ChevronRight,
  XCircle, Zap,
} from 'lucide-react';

type Network = 'mtn' | 'airtel' | 'glo' | '9mobile';
type Tab = 'buy' | 'bulk' | 'a2c' | 'auto-recharge';

const NETWORKS: { value: Network; label: string; color: string }[] = [
  { value: 'mtn', label: 'MTN', color: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30' },
  { value: 'airtel', label: 'Airtel', color: 'bg-red-400/15 text-red-400 border-red-400/30' },
  { value: 'glo', label: 'Glo', color: 'bg-green-400/15 text-green-400 border-green-400/30' },
  { value: '9mobile', label: '9Mobile', color: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30' },
];

const fmt = (k: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(k / 100);

// ─── Buy Airtime Panel ────────────────────────────────────────────────────────

function BuyAirtimePanel() {
  const [form, setForm] = useState({ phone: '', network: '' as Network | '', amount: '', pin: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const submit = async () => {
    if (!form.phone || !form.network || !form.amount || !form.pin) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/v1/airtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: form.phone,
          network: form.network,
          amount: Math.round(Number(form.amount) * 100),
          transactionPin: form.pin,
          idempotencyKey: `airtime-${Date.now()}-${form.phone}`,
        }),
      });
      const data = await res.json();
      setResult({ success: data.success, message: data.message ?? data.error });
      if (data.success) setForm(f => ({ ...f, amount: '', pin: '' }));
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

  return (
    <div className="space-y-4">
      {result && (
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${result.success ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>
          {result.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {result.message}
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">Network</label>
        <div className="grid grid-cols-4 gap-2">
          {NETWORKS.map(n => (
            <button
              key={n.value}
              onClick={() => setForm(f => ({ ...f, network: n.value }))}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${form.network === n.value ? n.color : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}
            >
              {n.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">Phone number</label>
        <input
          type="tel" className={inputCls} placeholder="08012345678"
          value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">Amount (₦)</label>
        <input
          type="number" min="10" max="100000" className={inputCls} placeholder="100"
          value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {[100, 200, 500, 1000, 2000, 5000].map(a => (
            <button key={a} onClick={() => setForm(f => ({ ...f, amount: String(a) }))}
              className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800">
              ₦{a.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">Transaction PIN</label>
        <input
          type="password" maxLength={4} className={inputCls} placeholder="••••"
          value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value }))}
        />
      </div>

      <button
        onClick={submit}
        disabled={loading || !form.phone || !form.network || !form.amount || !form.pin}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
        {loading ? 'Processing...' : 'Buy Airtime'}
      </button>
    </div>
  );
}

// ─── Bulk Airtime Panel ───────────────────────────────────────────────────────

function BulkAirtimePanel() {
  const [rows, setRows] = useState([{ phone: '', network: '' as Network | '', amount: '' }]);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<any>(null);
  const [error, setError] = useState('');

  const addRow = () => setRows(r => [...r, { phone: '', network: '', amount: '' }]);
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, k: string, v: string) =>
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/airtime/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: rows.map(r => ({
            phone: r.phone,
            ...(r.network ? { network: r.network } : {}),
            amount: Number(r.amount),
          })),
          transactionPin: pin,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Failed');
      setJobId(data.data.jobId);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Poll job status
  useEffect(() => {
    if (!jobId) return;
    const poll = async () => {
      const res = await fetch(`/api/v1/airtime/bulk?jobId=${jobId}`);
      const data = await res.json();
      if (data.success) setJob(data.data.job);
    };
    poll();
    const id = setInterval(() => {
      poll().then(() => {
        if (job?.status === 'completed' || job?.status === 'failed' || job?.status === 'partial') {
          clearInterval(id);
        }
      });
    }, 3000);
    return () => clearInterval(id);
  }, [jobId, job?.status]);

  const inputCls = 'rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

  if (jobId && job) {
    const isDone = ['completed', 'failed', 'partial'].includes(job.status);
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-white">Bulk job in progress</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${job.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' : job.status === 'failed' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
              {job.status}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div><p className="text-lg font-bold text-emerald-400">{job.successCount}</p><p className="text-xs text-slate-400">Sent</p></div>
            <div><p className="text-lg font-bold text-red-400">{job.failCount}</p><p className="text-xs text-slate-400">Failed</p></div>
            <div><p className="text-lg font-bold text-slate-300">{job.totalRows - job.successCount - job.failCount}</p><p className="text-xs text-slate-400">Pending</p></div>
          </div>
          {!isDone && <div className="mt-3 h-1.5 rounded-full bg-slate-800"><div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${((job.successCount + job.failCount) / job.totalRows) * 100}%` }} /></div>}
        </div>
        {isDone && (
          <button onClick={() => { setJobId(null); setJob(null); setRows([{ phone: '', network: '', amount: '' }]); }} className="w-full rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300 hover:bg-slate-800">
            New bulk job
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_100px_32px] gap-2 border-b border-slate-800 px-3 py-2 text-xs font-medium text-slate-400">
          <span>Phone number</span><span>Network</span><span>Amount (₦)</span><span />
        </div>
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_120px_100px_32px] gap-2 border-b border-slate-800/60 px-3 py-2 last:border-0">
            <input type="tel" className={inputCls} placeholder="0801..." value={row.phone} onChange={e => updateRow(i, 'phone', e.target.value)} />
            <select className={inputCls} value={row.network} onChange={e => updateRow(i, 'network', e.target.value)}>
              <option value="">Auto</option>
              {NETWORKS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
            <input type="number" min="10" className={inputCls} placeholder="100" value={row.amount} onChange={e => updateRow(i, 'amount', e.target.value)} />
            <button onClick={() => removeRow(i)} disabled={rows.length === 1} className="flex items-center justify-center text-slate-500 hover:text-red-400 disabled:opacity-30">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300">
        <Plus className="h-3.5 w-3.5" /> Add row
      </button>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">Transaction PIN</label>
        <input type="password" maxLength={4} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-indigo-500" placeholder="••••" value={pin} onChange={e => setPin(e.target.value)} />
      </div>

      <button onClick={submit} disabled={loading || rows.some(r => !r.phone || !r.amount) || !pin}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
        {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
        {loading ? 'Submitting...' : `Process ${rows.length} row${rows.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
}

// ─── A2C Panel ────────────────────────────────────────────────────────────────

function A2CPanel() {
  const [rates, setRates] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [form, setForm] = useState({ network: '' as Network | '', phone: '', faceValueNaira: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/airtime/a2c');
    const data = await res.json();
    if (data.success) {
      setRates(data.data.rates ?? []);
      setRequests(data.data.requests ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/v1/airtime/a2c', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network: form.network, phone: form.phone, faceValueNaira: Number(form.faceValueNaira) }),
      });
      const data = await res.json();
      setResult({ success: data.success, message: data.message ?? data.error, data: data.data });
      if (data.success) { setForm({ network: '', phone: '', faceValueNaira: '' }); load(); }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedRate = rates.find(r => r.network === form.network);
  const estimatedPayout = selectedRate && form.faceValueNaira
    ? (Number(form.faceValueNaira) * selectedRate.ratePercent / 100).toFixed(2)
    : null;

  const inputCls = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

  return (
    <div className="space-y-6">
      {/* Rate table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3">
          <h3 className="text-sm font-medium text-slate-300">Current payout rates</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><RefreshCw className="h-5 w-5 animate-spin text-indigo-400" /></div>
        ) : rates.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">Service not available.</p>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {rates.map(r => (
              <div key={r.network} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${NETWORKS.find(n => n.value === r.network)?.color ?? ''}`}>{r.network}</span>
                <span className="text-white font-medium">{r.ratePercent}% payout</span>
                <span className="text-slate-400">Min: ₦{r.minAmountNaira?.toLocaleString() ?? '100'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit form */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-200">Submit a request</h3>
        {result && (
          <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${result.success ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>
            {result.success ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
            <div>
              <p>{result.message}</p>
              {result.success && result.data && (
                <p className="mt-1 font-medium">You'll receive ₦{result.data.payoutNaira?.toFixed(2)} in your wallet.</p>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Network</label>
          <div className="grid grid-cols-4 gap-2">
            {NETWORKS.filter(n => rates.some(r => r.network === n.value)).map(n => (
              <button key={n.value} onClick={() => setForm(f => ({ ...f, network: n.value }))}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${form.network === n.value ? n.color : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                {n.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Your phone number</label>
          <input type="tel" className={inputCls} placeholder="08012345678" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Airtime face value (₦)</label>
          <input type="number" min="100" className={inputCls} placeholder="500" value={form.faceValueNaira} onChange={e => setForm(f => ({ ...f, faceValueNaira: e.target.value }))} />
          {estimatedPayout && (
            <p className="mt-1.5 text-xs text-emerald-400">
              Estimated wallet credit: <span className="font-semibold">₦{estimatedPayout}</span> ({selectedRate.ratePercent}% of face value)
            </p>
          )}
        </div>

        <button onClick={submit} disabled={submitting || !form.network || !form.phone || !form.faceValueNaira}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
          {submitting && <RefreshCw className="h-4 w-4 animate-spin" />}
          Submit Request
        </button>
      </div>

      {/* History */}
      {requests.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-200">Your requests</h3>
          <div className="space-y-2">
            {requests.slice(0, 5).map(r => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-white">{r.network.toUpperCase()} — {fmt(r.faceValueKobo)}</p>
                  <p className="text-xs text-slate-400">Payout: {fmt(r.payoutKobo)} · {r.ratePercent}%</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${r.status === 'credited' ? 'bg-emerald-500/15 text-emerald-400' : r.status === 'rejected' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Auto-Recharge Panel ──────────────────────────────────────────────────────

function AutoRechargePanel() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ phone: '', network: '' as Network | '', triggerBalanceNaira: '', rechargeAmountNaira: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/airtime/auto-recharge');
    const data = await res.json();
    if (data.success) setRules(data.data.rules ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/v1/airtime/auto-recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: form.phone,
          network: form.network,
          triggerBalanceNaira: Number(form.triggerBalanceNaira),
          rechargeAmountNaira: Number(form.rechargeAmountNaira),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Failed');
      setShowForm(false);
      setForm({ phone: '', network: '', triggerBalanceNaira: '', rechargeAmountNaira: '' });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (ruleId: string) => {
    setDeleting(ruleId);
    await fetch('/api/v1/airtime/auto-recharge', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleId }),
    });
    setDeleting(null);
    load();
  };

  const inputCls = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

  return (
    <div className="space-y-4">
      {!showForm && (
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-sm text-indigo-400 hover:bg-indigo-500/20">
          <Plus className="h-4 w-4" /> Add auto-recharge rule
        </button>
      )}

      {showForm && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">New auto-recharge rule</h3>
          {error && <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Network</label>
            <div className="grid grid-cols-4 gap-2">
              {NETWORKS.map(n => (
                <button key={n.value} onClick={() => setForm(f => ({ ...f, network: n.value }))}
                  className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${form.network === n.value ? n.color : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                  {n.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Phone number</label>
            <input type="tel" className={inputCls} placeholder="08012345678" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Recharge when balance below (₦)</label>
              <input type="number" min="0" className={inputCls} placeholder="500" value={form.triggerBalanceNaira} onChange={e => setForm(f => ({ ...f, triggerBalanceNaira: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Top-up amount (₦)</label>
              <input type="number" min="10" className={inputCls} placeholder="200" value={form.rechargeAmountNaira} onChange={e => setForm(f => ({ ...f, rechargeAmountNaira: e.target.value }))} />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setShowForm(false); setError(''); }} className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300 hover:bg-slate-800">
              Cancel
            </button>
            <button onClick={save} disabled={saving || !form.phone || !form.network || !form.triggerBalanceNaira || !form.rechargeAmountNaira}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
              {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
              Save rule
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-indigo-400" /></div>
      ) : rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 py-12 text-center">
          <Zap className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">No auto-recharge rules yet.</p>
          <p className="text-xs text-slate-500 mt-1">Add a rule to top up airtime automatically.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(r => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${NETWORKS.find(n => n.value === r.network)?.color ?? ''}`}>{r.network}</span>
                  <span className="text-sm font-medium text-white">{r.phone}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Recharge ₦{(r.rechargeAmountKobo / 100).toLocaleString()} when balance &lt; ₦{(r.triggerBalanceKobo / 100).toLocaleString()}
                </p>
              </div>
              <button onClick={() => deleteRule(r.id)} disabled={deleting === r.id}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">
                {deleting === r.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function AirtimePage() {
  const [tab, setTab] = useState<Tab>('buy');

  const tabs: { value: Tab; label: string; icon: React.ReactNode }[] = [
    { value: 'buy', label: 'Buy Airtime', icon: <Smartphone className="h-4 w-4" /> },
    { value: 'bulk', label: 'Bulk', icon: <Upload className="h-4 w-4" /> },
    { value: 'a2c', label: 'Airtime to Cash', icon: <TrendingDown className="h-4 w-4" /> },
    { value: 'auto-recharge', label: 'Auto-Recharge', icon: <Settings2 className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Airtime</h1>
          <p className="mt-1 text-sm text-slate-400">Purchase airtime, run bulk top-ups, or convert airtime to wallet cash.</p>
        </div>

        {/* Tab nav */}
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50 p-1">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${tab === t.value ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          {tab === 'buy' && <BuyAirtimePanel />}
          {tab === 'bulk' && <BulkAirtimePanel />}
          {tab === 'a2c' && <A2CPanel />}
          {tab === 'auto-recharge' && <AutoRechargePanel />}
        </div>
      </div>
    </div>
  );
}