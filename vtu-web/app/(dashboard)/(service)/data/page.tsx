// vtu-web/app/(dashboard)/data/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wifi, Upload, Gift, Calendar, RefreshCw, AlertCircle,
  CheckCircle2, Trash2, Plus, XCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Network = 'mtn' | 'airtel' | 'glo' | '9mobile';
type Category = 'SME' | 'Gifting' | 'Corporate' | 'Direct';
type Tab = 'buy' | 'bulk' | 'gift' | 'scheduled';

interface DataPlan {
  id: string;
  network: Network;
  name: string;
  size: string;
  validity: string;
  priceKobo: number;
  category: Category;
}

interface ScheduledRule {
  id: string;
  phone: string;
  network: Network;
  planName: string;
  priceKobo: number;
  renewalDay: number | null;
  intervalDays: number | null;
  nextTriggerAt: { _seconds: number };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NETWORKS: { value: Network; label: string; color: string }[] = [
  { value: 'mtn',     label: 'MTN',     color: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30' },
  { value: 'airtel',  label: 'Airtel',  color: 'bg-red-400/15 text-red-400 border-red-400/30' },
  { value: 'glo',     label: 'Glo',     color: 'bg-green-400/15 text-green-400 border-green-400/30' },
  { value: '9mobile', label: '9Mobile', color: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30' },
];

const CATEGORIES: Category[] = ['SME', 'Gifting', 'Corporate', 'Direct'];

const fmt = (k: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(k / 100);

const fmtDate = (s: number) =>
  new Date(s * 1000).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

const netColor = (n: Network) =>
  NETWORKS.find(x => x.value === n)?.color ?? 'bg-slate-700 text-slate-300 border-slate-600';

// ─── Shared input styles ──────────────────────────────────────────────────────

const inputCls = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';
const selectCls = inputCls;

// ─── Network selector ─────────────────────────────────────────────────────────

function NetworkSelector({ value, onChange }: { value: Network | ''; onChange: (n: Network) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {NETWORKS.map(n => (
        <button
          key={n.value}
          onClick={() => onChange(n.value)}
          className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
            value === n.value ? n.color : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
          }`}
        >
          {n.label}
        </button>
      ))}
    </div>
  );
}

// ─── Result banner ────────────────────────────────────────────────────────────

function ResultBanner({ result }: { result: { success: boolean; message: string } }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
      result.success
        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
        : 'border-red-500/20 bg-red-500/10 text-red-400'
    }`}>
      {result.success
        ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
        : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
      {result.message}
    </div>
  );
}

// ─── Buy Data Panel ───────────────────────────────────────────────────────────

function BuyDataPanel() {
  const [network, setNetwork] = useState<Network | ''>('');
  const [category, setCategory] = useState<Category>('SME');
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [dataBalance, setDataBalance] = useState<string | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);

  const fetchPlans = useCallback(async (net: Network, cat: Category) => {
    setFetching(true);
    setPlans([]);
    setSelectedPlan(null);
    try {
      const res = await fetch(`/api/v1/data?network=${net}&category=${cat}`);
      const data = await res.json();
      if (data.success) setPlans(data.data.plans ?? []);
    } catch { /* ignore */ }
    finally { setFetching(false); }
  }, []);

  useEffect(() => {
    if (network) fetchPlans(network, category);
  }, [network, category, fetchPlans]);

  const checkBalance = async () => {
    if (!phone || !network) return;
    setCheckingBalance(true);
    setDataBalance(null);
    try {
      const res = await fetch(`/api/v1/data/balance?phone=${encodeURIComponent(phone)}&network=${network}`);
      const data = await res.json();
      if (data.success) setDataBalance(JSON.stringify(data.data.balance));
      else setDataBalance('Balance check not supported for this network.');
    } catch { setDataBalance('Could not retrieve balance.'); }
    finally { setCheckingBalance(false); }
  };

  const submit = async () => {
    if (!phone || !network || !selectedPlan || !pin) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/v1/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          network,
          planId: selectedPlan.id,
          transactionPin: pin,
          idempotencyKey: `data-${Date.now()}-${phone}`,
        }),
      });
      const data = await res.json();
      setResult({ success: data.success, message: data.message ?? data.error });
      if (data.success) { setPin(''); setSelectedPlan(null); }
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      {result && <ResultBanner result={result} />}

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">Network</label>
        <NetworkSelector value={network} onChange={n => { setNetwork(n); setSelectedPlan(null); }} />
      </div>

      {network && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Category</label>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  category === c
                    ? 'border-indigo-500 bg-indigo-500/15 text-indigo-400'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs font-medium text-slate-400">Phone number</label>
          {network && phone && (
            <button
              onClick={checkBalance}
              disabled={checkingBalance}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
            >
              {checkingBalance && <RefreshCw className="h-3 w-3 animate-spin" />}
              Check balance
            </button>
          )}
        </div>
        <input
          type="tel"
          className={inputCls}
          placeholder="08012345678"
          value={phone}
          onChange={e => setPhone(e.target.value)}
        />
        {dataBalance && (
          <p className="mt-1.5 text-xs text-slate-400">Balance: <span className="text-slate-200">{dataBalance}</span></p>
        )}
      </div>

      {/* Plan picker */}
      {network && (
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-400">
            Select plan {fetching && <RefreshCw className="inline h-3 w-3 animate-spin ml-1" />}
          </label>
          {plans.length === 0 && !fetching ? (
            <p className="text-sm text-slate-500">No plans available for this network/category.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {plans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(selectedPlan?.id === plan.id ? null : plan)}
                  className={`rounded-xl border p-3 text-left transition ${
                    selectedPlan?.id === plan.id
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-sm">{plan.size}</span>
                    <span className="text-sm font-bold text-indigo-400">{fmt(plan.priceKobo)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{plan.name} · {plan.validity}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedPlan && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-sm">
          <p className="text-slate-300">Selected: <span className="text-white font-medium">{selectedPlan.name}</span> — {selectedPlan.size} for {fmt(selectedPlan.priceKobo)}</p>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">Transaction PIN</label>
        <input type="password" maxLength={4} className={inputCls} placeholder="••••" value={pin} onChange={e => setPin(e.target.value)} />
      </div>

      <button
        onClick={submit}
        disabled={loading || !phone || !network || !selectedPlan || !pin}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
        {loading ? 'Processing...' : 'Buy Data'}
      </button>
    </div>
  );
}

// ─── Bulk Data Panel ──────────────────────────────────────────────────────────

function BulkDataPanel() {
  const [rows, setRows] = useState([{ phone: '', network: '' as Network | '', planId: '', planLabel: '' }]);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<any>(null);
  const [error, setError] = useState('');
  const [plansByNetwork, setPlansByNetwork] = useState<Record<string, DataPlan[]>>({});

  const fetchPlansForNetwork = async (network: Network) => {
    if (plansByNetwork[network]) return;
    try {
      const res = await fetch(`/api/v1/data?network=${network}`);
      const data = await res.json();
      if (data.success) {
        setPlansByNetwork(prev => ({ ...prev, [network]: data.data.plans ?? [] }));
      }
    } catch { /* ignore */ }
  };

  const updateRow = (i: number, k: string, v: string) => {
    setRows(r => r.map((row, idx) => {
      if (idx !== i) return row;
      if (k === 'network') fetchPlansForNetwork(v as Network);
      return { ...row, [k]: v, ...(k === 'network' ? { planId: '', planLabel: '' } : {}) };
    }));
  };

  const addRow = () => setRows(r => [...r, { phone: '', network: '', planId: '', planLabel: '' }]);
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/data/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: rows.map(r => ({ phone: r.phone, network: r.network, planId: r.planId })),
          transactionPin: pin,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Failed');
      setJobId(data.data.jobId);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!jobId) return;
    const poll = async () => {
      const res = await fetch(`/api/v1/data/bulk?jobId=${jobId}`);
      const data = await res.json();
      if (data.success) setJob(data.data.job);
    };
    poll();
    const id = setInterval(() => {
      if (job?.status === 'completed' || job?.status === 'failed' || job?.status === 'partial') {
        clearInterval(id);
        return;
      }
      poll();
    }, 3000);
    return () => clearInterval(id);
  }, [jobId, job?.status]);

  if (jobId && job) {
    const isDone = ['completed', 'failed', 'partial'].includes(job.status);
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-white">Bulk data job</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
              job.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400'
              : job.status === 'failed' ? 'bg-red-500/15 text-red-400'
              : 'bg-amber-500/15 text-amber-400'
            }`}>{job.status}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div><p className="text-lg font-bold text-emerald-400">{job.successCount}</p><p className="text-xs text-slate-400">Sent</p></div>
            <div><p className="text-lg font-bold text-red-400">{job.failCount}</p><p className="text-xs text-slate-400">Failed</p></div>
            <div><p className="text-lg font-bold text-slate-300">{job.totalRows - job.successCount - job.failCount}</p><p className="text-xs text-slate-400">Pending</p></div>
          </div>
          {!isDone && (
            <div className="mt-3 h-1.5 rounded-full bg-slate-800">
              <div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${((job.successCount + job.failCount) / job.totalRows) * 100}%` }} />
            </div>
          )}
        </div>
        {isDone && (
          <button onClick={() => { setJobId(null); setJob(null); setRows([{ phone: '', network: '', planId: '', planLabel: '' }]); }}
            className="w-full rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300 hover:bg-slate-800">
            New bulk job
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <ResultBanner result={{ success: false, message: error }} />}

      <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
        <div className="grid grid-cols-[1fr_110px_1fr_32px] gap-2 border-b border-slate-800 px-3 py-2 text-xs font-medium text-slate-400">
          <span>Phone</span><span>Network</span><span>Plan</span><span />
        </div>
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_110px_1fr_32px] gap-2 border-b border-slate-800/60 px-3 py-2 last:border-0">
            <input type="tel" placeholder="0801..." value={row.phone}
              onChange={e => updateRow(i, 'phone', e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-indigo-500" />
            <select value={row.network} onChange={e => updateRow(i, 'network', e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-indigo-500">
              <option value="">Network</option>
              {NETWORKS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
            <select value={row.planId} onChange={e => updateRow(i, 'planId', e.target.value)}
              disabled={!row.network}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-indigo-500 disabled:opacity-40">
              <option value="">Pick plan</option>
              {(plansByNetwork[row.network] ?? []).map(p => (
                <option key={p.id} value={p.id}>{p.size} — {fmt(p.priceKobo)}</option>
              ))}
            </select>
            <button onClick={() => removeRow(i)} disabled={rows.length === 1}
              className="flex items-center justify-center text-slate-500 hover:text-red-400 disabled:opacity-30">
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
        <input type="password" maxLength={4} className={inputCls} placeholder="••••" value={pin} onChange={e => setPin(e.target.value)} />
      </div>

      <button onClick={submit}
        disabled={loading || rows.some(r => !r.phone || !r.network || !r.planId) || !pin}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
        {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
        {loading ? 'Submitting...' : `Process ${rows.length} row${rows.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
}

// ─── Gift Data Panel ──────────────────────────────────────────────────────────

function GiftDataPanel() {
  const [network, setNetwork] = useState<Network | ''>('');
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
  const [fetching, setFetching] = useState(false);
  const [form, setForm] = useState({ phone: '', recipientEmail: '', recipientName: '', personalMessage: '', pin: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const fetchPlans = async (net: Network) => {
    setFetching(true);
    setPlans([]);
    setSelectedPlan(null);
    try {
      const res = await fetch(`/api/v1/data?network=${net}`);
      const data = await res.json();
      if (data.success) setPlans(data.data.plans ?? []);
    } finally { setFetching(false); }
  };

  useEffect(() => { if (network) fetchPlans(network); }, [network]);

  const submit = async () => {
    if (!form.phone || !form.recipientEmail || !form.recipientName || !selectedPlan || !form.pin || !network) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/v1/data/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: form.phone,
          network,
          planId: selectedPlan.id,
          recipientEmail: form.recipientEmail,
          recipientName: form.recipientName,
          personalMessage: form.personalMessage || undefined,
          transactionPin: form.pin,
          idempotencyKey: `gift-${Date.now()}-${form.recipientEmail}`,
        }),
      });
      const data = await res.json();
      setResult({ success: data.success, message: data.message ?? data.error });
      if (data.success) {
        setForm({ phone: '', recipientEmail: '', recipientName: '', personalMessage: '', pin: '' });
        setSelectedPlan(null);
      }
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      {result && <ResultBanner result={result} />}

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">Network</label>
        <NetworkSelector value={network} onChange={n => { setNetwork(n); }} />
      </div>

      {network && (
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-400">
            Select plan {fetching && <RefreshCw className="inline h-3 w-3 animate-spin ml-1" />}
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {plans.map(plan => (
              <button key={plan.id} onClick={() => setSelectedPlan(selectedPlan?.id === plan.id ? null : plan)}
                className={`rounded-xl border p-3 text-left transition ${selectedPlan?.id === plan.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-sm">{plan.size}</span>
                  <span className="text-sm font-bold text-indigo-400">{fmt(plan.priceKobo)}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{plan.name} · {plan.validity}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Recipient's phone</label>
          <input type="tel" className={inputCls} placeholder="08012345678" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Recipient's name</label>
          <input type="text" className={inputCls} placeholder="Jane Doe" value={form.recipientName} onChange={e => set('recipientName', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">Recipient's email (for delivery notification)</label>
        <input type="email" className={inputCls} placeholder="jane@example.com" value={form.recipientEmail} onChange={e => set('recipientEmail', e.target.value)} />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">Personal message (optional, max 200 chars)</label>
        <textarea rows={2} className={inputCls} placeholder="Happy birthday! 🎉" maxLength={200}
          value={form.personalMessage} onChange={e => set('personalMessage', e.target.value)} />
        <p className="mt-1 text-right text-xs text-slate-500">{form.personalMessage.length}/200</p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">Transaction PIN</label>
        <input type="password" maxLength={4} className={inputCls} placeholder="••••" value={form.pin} onChange={e => set('pin', e.target.value)} />
      </div>

      <button onClick={submit}
        disabled={loading || !form.phone || !form.recipientEmail || !form.recipientName || !selectedPlan || !form.pin}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
        {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
        {loading ? 'Sending gift...' : '🎁 Send Data Gift'}
      </button>
    </div>
  );
}

// ─── Scheduled Data Panel ─────────────────────────────────────────────────────

function ScheduledDataPanel() {
  const [rules, setRules] = useState<ScheduledRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [form, setForm] = useState({
    phone: '', network: '' as Network | '', planId: '',
    scheduleType: 'interval' as 'interval' | 'day-of-month',
    intervalDays: '30', renewalDay: '1',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/data/scheduled');
      const data = await res.json();
      if (data.success) setRules(data.data.rules ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fetchPlans = async (network: Network) => {
    try {
      const res = await fetch(`/api/v1/data?network=${network}`);
      const data = await res.json();
      if (data.success) setPlans(data.data.plans ?? []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (form.network) fetchPlans(form.network as Network);
  }, [form.network]);

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        phone: form.phone,
        network: form.network,
        planId: form.planId,
      };
      if (form.scheduleType === 'interval') {
        body.intervalDays = Number(form.intervalDays);
      } else {
        body.renewalDay = Number(form.renewalDay);
      }

      const res = await fetch('/api/v1/data/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Failed');
      setShowForm(false);
      setForm({ phone: '', network: '', planId: '', scheduleType: 'interval', intervalDays: '30', renewalDay: '1' });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally { setSaving(false); }
  };

  const deleteRule = async (ruleId: string) => {
    setDeleting(ruleId);
    await fetch('/api/v1/data/scheduled', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleId }),
    });
    setDeleting(null);
    load();
  };

  return (
    <div className="space-y-4">
      {!showForm && (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-sm text-indigo-400 hover:bg-indigo-500/20">
          <Plus className="h-4 w-4" /> Add renewal rule
        </button>
      )}

      {showForm && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">New scheduled data rule</h3>
          {error && <ResultBanner result={{ success: false, message: error }} />}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Network</label>
            <NetworkSelector value={form.network} onChange={n => set('network', n)} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Phone number</label>
            <input type="tel" className={inputCls} placeholder="08012345678" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Data plan</label>
            <select className={selectCls} value={form.planId} onChange={e => set('planId', e.target.value)} disabled={!form.network}>
              <option value="">Select a plan</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.size} — {fmt(p.priceKobo)} — {p.validity}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Schedule type</label>
            <div className="flex gap-2">
              {(['interval', 'day-of-month'] as const).map(t => (
                <button key={t} onClick={() => set('scheduleType', t)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition ${
                    form.scheduleType === t ? 'border-indigo-500 bg-indigo-500/15 text-indigo-400' : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}>
                  {t === 'interval' ? 'Every N days' : 'Day of month'}
                </button>
              ))}
            </div>
          </div>

          {form.scheduleType === 'interval' ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Interval (days)</label>
              <input type="number" min="1" max="365" className={inputCls} value={form.intervalDays} onChange={e => set('intervalDays', e.target.value)} />
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Day of month (1–28)</label>
              <input type="number" min="1" max="28" className={inputCls} value={form.renewalDay} onChange={e => set('renewalDay', e.target.value)} />
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => { setShowForm(false); setError(''); }}
              className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300 hover:bg-slate-800">
              Cancel
            </button>
            <button onClick={save} disabled={saving || !form.phone || !form.network || !form.planId}
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
          <Calendar className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">No scheduled renewals yet.</p>
          <p className="text-xs text-slate-500 mt-1">Set up auto-renewal so you never run out of data.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div key={rule.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${netColor(rule.network)}`}>
                    {rule.network}
                  </span>
                  <span className="text-sm font-medium text-white">{rule.phone}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {rule.planName} · {fmt(rule.priceKobo)} ·{' '}
                  {rule.renewalDay ? `Every month on day ${rule.renewalDay}` : `Every ${rule.intervalDays} days`}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">Next: {fmtDate(rule.nextTriggerAt._seconds)}</p>
              </div>
              <button onClick={() => deleteRule(rule.id)} disabled={deleting === rule.id}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">
                {deleting === rule.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
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

export default function DataPage() {
  const [tab, setTab] = useState<Tab>('buy');

  const tabs: { value: Tab; label: string; icon: React.ReactNode }[] = [
    { value: 'buy',       label: 'Buy Data',       icon: <Wifi className="h-4 w-4" /> },
    { value: 'bulk',      label: 'Bulk',           icon: <Upload className="h-4 w-4" /> },
    { value: 'gift',      label: 'Gift Data',      icon: <Gift className="h-4 w-4" /> },
    { value: 'scheduled', label: 'Auto-Renew',     icon: <Calendar className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Data</h1>
          <p className="mt-1 text-sm text-slate-400">
            Buy data bundles, send gifts, or set up automatic renewals.
          </p>
        </div>

        {/* Tab nav */}
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50 p-1">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === t.value ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          {tab === 'buy'       && <BuyDataPanel />}
          {tab === 'bulk'      && <BulkDataPanel />}
          {tab === 'gift'      && <GiftDataPanel />}
          {tab === 'scheduled' && <ScheduledDataPanel />}
        </div>
      </div>
    </div>
  );
}