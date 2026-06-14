// vtu-web/app/(admin)/cashback/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, RefreshCw, ArchiveX, BarChart2, Pencil, ChevronDown,
  CheckCircle2, XCircle, Clock, TrendingUp, Users, Wallet,
  Layers, AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CampaignFeatures {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  isArchived: boolean;
  cashbackType: 'percentage' | 'flat';
  cashbackValue: number;
  targetService: string;
  userSegment: string;
  stackingRule: 'stackable' | 'exclusive';
  maxCashbackPerUser: number;
  totalBudgetKobo: number;
  totalPaidKobo: number;
  totalTriggeredCount: number;
  startDate: { _seconds: number };
  endDate: { _seconds: number };
  createdAt: { _seconds: number };
}

interface Analytics {
  uniqueUsersRewarded: number;
  budgetUtilisationPct: number;
  avgCashbackKobo: number;
  roiEstimate: string;
  remainingBudgetKobo: number;
  topServices: Array<{ service: string; count: number; totalKobo: number }>;
}

const SERVICE_OPTIONS = ['*', 'airtime', 'data', 'electricity', 'cable', 'exam_pin', 'sms'];
const SEGMENT_OPTIONS = [
  { value: 'all', label: 'All users' },
  { value: 'new_users', label: 'New users (≤30 days)' },
  { value: 'kyc_tier_1', label: 'KYC Tier 1+' },
  { value: 'kyc_tier_2', label: 'KYC Tier 2+' },
  { value: 'plan_starter', label: 'Starter plan' },
  { value: 'plan_pro', label: 'Pro plan' },
  { value: 'plan_enterprise', label: 'Enterprise plan' },
];

const EMPTY_FORM = {
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  targetService: 'airtime',
  userSegment: 'all',
  cashbackType: 'percentage' as const,
  cashbackValue: '',
  maxCashbackPerUser: '',
  totalBudgetKobo: '',
  stackingRule: 'stackable' as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (k: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(k / 100);

const fmtDate = (s: number) =>
  new Date(s * 1000).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

const isLive = (c: CampaignFeatures) => {
  const now = Date.now() / 1000;
  return c.isActive && !c.isArchived && c.startDate._seconds <= now && c.endDate._seconds >= now;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ campaign }: { campaign: CampaignFeatures }) {
  if (campaign.isArchived)
    return <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400"><ArchiveX className="h-3 w-3" /> Archived</span>;
  if (isLive(campaign))
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Live</span>;
  if (!campaign.isActive)
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400"><XCircle className="h-3 w-3" /> Paused</span>;
  const now = Date.now() / 1000;
  if (campaign.startDate._seconds > now)
    return <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-blue-400"><Clock className="h-3 w-3" /> Scheduled</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400"><Clock className="h-3 w-3" /> Ended</span>;
}

function BudgetBar({ used, total }: { used: number; total: number }) {
  if (total === 0) return <span className="text-xs text-slate-500">No cap</span>;
  const pct = Math.min(100, Math.round((used / total) * 100));
  const color = pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-slate-800">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400">{pct}%</span>
    </div>
  );
}

// ─── Analytics Modal ──────────────────────────────────────────────────────────

function AnalyticsModal({
  campaign,
  onClose,
}: { campaign: CampaignFeatures; onClose: () => void }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/internal/cashback/campaigns/${campaign.id}/analytics`)
      .then(r => r.json())
      .then(d => setData(d.data?.analytics ?? null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [campaign.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <p className="text-xs text-slate-400">Campaign analytics</p>
            <h2 className="font-semibold text-white">{campaign.name}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
            </div>
          ) : !data ? (
            <p className="py-8 text-center text-sm text-slate-400">No analytics data yet.</p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total paid', value: fmt(data.totalPaidKobo ?? campaign.totalPaidKobo), icon: Wallet },
                  { label: 'Triggers', value: campaign.totalTriggeredCount.toLocaleString(), icon: TrendingUp },
                  { label: 'Unique users', value: data.uniqueUsersRewarded.toLocaleString(), icon: Users },
                  { label: 'Avg cashback', value: fmt(data.avgCashbackKobo), icon: Layers },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Icon className="h-4 w-4" />
                      <span className="text-xs">{label}</span>
                    </div>
                    <p className="mt-1 text-lg font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>

              {campaign.totalBudgetKobo > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                    <span>Budget utilisation</span>
                    <span>{data.budgetUtilisationPct}% used</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800">
                    <div
                      className={`h-2 rounded-full ${data.budgetUtilisationPct >= 90 ? 'bg-red-500' : data.budgetUtilisationPct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${data.budgetUtilisationPct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs text-slate-500">
                    <span>{fmt(campaign.totalPaidKobo)} paid</span>
                    <span>{fmt(data.remainingBudgetKobo)} remaining</span>
                  </div>
                </div>
              )}

              {data.topServices?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-400">Top services</p>
                  <div className="space-y-1.5">
                    {data.topServices.map(s => (
                      <div key={s.service} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2 text-sm">
                        <span className="capitalize text-slate-300">{s.service.replace(/_/g, ' ')}</span>
                        <span className="text-slate-400">{s.count} × {fmt(s.totalKobo)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-xs text-indigo-300">
                <strong className="font-medium">ROI estimate:</strong> {data.roiEstimate}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create / Edit Form Modal ─────────────────────────────────────────────────

function CampaignFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: CampaignFeatures | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState(
    initial
      ? {
          name: initial.name,
          description: initial.description,
          startDate: new Date(initial.startDate._seconds * 1000).toISOString().slice(0, 16),
          endDate: new Date(initial.endDate._seconds * 1000).toISOString().slice(0, 16),
          targetService: initial.targetService,
          userSegment: initial.userSegment,
          cashbackType: initial.cashbackType,
          cashbackValue: String(initial.cashbackValue),
          maxCashbackPerUser: initial.maxCashbackPerUser === 0 ? '' : String(initial.maxCashbackPerUser / 100),
          totalBudgetKobo: initial.totalBudgetKobo === 0 ? '' : String(initial.totalBudgetKobo / 100),
          stackingRule: initial.stackingRule,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setError('');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        description: form.description,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        targetService: form.targetService,
        userSegment: form.userSegment,
        cashbackType: form.cashbackType,
        cashbackValue: Number(form.cashbackValue),
        maxCashbackPerUser: form.maxCashbackPerUser
          ? Math.round(Number(form.maxCashbackPerUser) * 100)
          : 0,
        totalBudgetKobo: form.totalBudgetKobo
          ? Math.round(Number(form.totalBudgetKobo) * 100)
          : 0,
        stackingRule: form.stackingRule,
      };

      const url = isEdit
        ? `/api/internal/cashback/campaigns/${initial!.id}`
        : '/api/internal/cashback/campaigns';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
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

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );

  const inputCls = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';
  const selectCls = inputCls;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl my-4">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="font-semibold text-white">{isEdit ? 'Edit campaign' : 'New campaign'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}

          <Field label="Campaign name">
            <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Eid Airtime Boost" />
          </Field>

          <Field label="Description">
            <textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional — shown to support teams" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date">
              <input type="datetime-local" className={inputCls} value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </Field>
            <Field label="End date">
              <input type="datetime-local" className={inputCls} value={form.endDate} onChange={e => set('endDate', e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Target service">
              <select className={selectCls} value={form.targetService} onChange={e => set('targetService', e.target.value)}>
                {SERVICE_OPTIONS.map(s => (
                  <option key={s} value={s}>{s === '*' ? 'Any service' : s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </Field>
            <Field label="User segment">
              <select className={selectCls} value={form.userSegment} onChange={e => set('userSegment', e.target.value)}>
                {SEGMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Cashback type">
              <select className={selectCls} value={form.cashbackType} onChange={e => set('cashbackType', e.target.value)}>
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat amount (₦)</option>
              </select>
            </Field>
            <Field label={form.cashbackType === 'percentage' ? 'Cashback %' : 'Cashback amount (₦)'}>
              <input type="number" min="0" className={inputCls} value={form.cashbackValue} onChange={e => set('cashbackValue', e.target.value)} placeholder={form.cashbackType === 'percentage' ? '5' : '100'} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Max per user (₦, 0 = unlimited)">
              <input type="number" min="0" className={inputCls} value={form.maxCashbackPerUser} onChange={e => set('maxCashbackPerUser', e.target.value)} placeholder="0" />
            </Field>
            <Field label="Total budget (₦, 0 = unlimited)">
              <input type="number" min="0" className={inputCls} value={form.totalBudgetKobo} onChange={e => set('totalBudgetKobo', e.target.value)} placeholder="0" />
            </Field>
          </div>

          <Field label="Stacking rule">
            <select className={selectCls} value={form.stackingRule} onChange={e => set('stackingRule', e.target.value as 'stackable' | 'exclusive')}>
              <option value="stackable">Stackable — combines with coupon discounts</option>
              <option value="exclusive">Exclusive — skipped if coupon is applied</option>
            </select>
          </Field>
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
            {isEdit ? 'Save changes' : 'Create campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function CashbackCampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignFeatures[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<CampaignFeatures | null>(null);
  const [analytics, setAnalytics] = useState<CampaignFeatures | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === 'archived'
        ? '?includeArchived=true'
        : filter === 'active' ? '?activeOnly=true' : '?includeArchived=true';
      const res = await fetch(`/api/internal/cashback/campaigns${params}`);
      const data = await res.json();
      let list: CampaignFeatures[] = data.data?.campaigns ?? [];
      if (filter === 'all') list = list.filter(c => !c.isArchived);
      if (filter === 'archived') list = list.filter(c => c.isArchived);
      setCampaigns(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const archive = async (id: string) => {
    if (!confirm('Archive this campaign? It will stop triggering cashback.')) return;
    setArchiving(id);
    await fetch(`/api/internal/cashback/campaigns/${id}`, { method: 'DELETE' });
    setArchiving(null);
    load();
  };

  const toggle = async (c: CampaignFeatures) => {
    setToggling(c.id);
    await fetch(`/api/internal/cashback/campaigns/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    setToggling(null);
    load();
  };

  // Summary stats
  const live = campaigns.filter(c => isLive(c));
  const totalPaid = campaigns.reduce((s, c) => s + c.totalPaidKobo, 0);
  const totalTriggers = campaigns.reduce((s, c) => s + c.totalTriggeredCount, 0);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Cashback Campaigns</h1>
          <p className="mt-1 text-sm text-slate-400">Create and manage cashback incentive programs for your users.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/10 hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" /> New campaign
        </button>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Live campaigns', value: live.length, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Total campaigns', value: campaigns.length, icon: Layers, color: 'text-indigo-400' },
          { label: 'Total paid out', value: fmt(totalPaid), icon: Wallet, color: 'text-amber-400' },
          { label: 'Total triggers', value: totalTriggers.toLocaleString(), icon: TrendingUp, color: 'text-blue-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <Icon className={`h-5 w-5 ${color}`} />
            <p className="mt-3 text-xl font-bold text-white">{value}</p>
            <p className="mt-0.5 text-xs text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-slate-800 bg-slate-900/50 p-1 w-fit">
        {(['all', 'active', 'archived'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition ${filter === f ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {f}
          </button>
        ))}
        <button onClick={load} className="ml-2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Campaign list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-16 text-center">
          <Layers className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">No campaigns yet. Create one to start rewarding users.</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
            Create campaign
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 transition hover:border-slate-700">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-white">{c.name}</h3>
                    <StatusBadge campaign={c} />
                    {c.stackingRule === 'exclusive' && (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">Exclusive</span>
                    )}
                  </div>
                  {c.description && (
                    <p className="mt-0.5 text-xs text-slate-500 truncate max-w-md">{c.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
                    <span>
                      <span className="text-slate-500">Service:</span>{' '}
                      {c.targetService === '*' ? 'Any' : c.targetService.replace(/_/g, ' ')}
                    </span>
                    <span>
                      <span className="text-slate-500">Segment:</span>{' '}
                      {SEGMENT_OPTIONS.find(o => o.value === c.userSegment)?.label ?? c.userSegment}
                    </span>
                    <span>
                      <span className="text-slate-500">Reward:</span>{' '}
                      {c.cashbackType === 'percentage' ? `${c.cashbackValue}%` : fmt(c.cashbackValue)}
                    </span>
                    <span>
                      <span className="text-slate-500">Period:</span>{' '}
                      {fmtDate(c.startDate._seconds)} → {fmtDate(c.endDate._seconds)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    onClick={() => setAnalytics(c)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    <BarChart2 className="h-3.5 w-3.5" /> Analytics
                  </button>
                  {!c.isArchived && (
                    <>
                      <button
                        onClick={() => setEditing(c)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => toggle(c)}
                        disabled={toggling === c.id}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${c.isActive ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'}`}
                      >
                        {toggling === c.id
                          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          : c.isActive ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        {c.isActive ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        onClick={() => archive(c.id)}
                        disabled={archiving === c.id}
                        className="flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                      >
                        {archiving === c.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ArchiveX className="h-3.5 w-3.5" />}
                        Archive
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Progress row */}
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-800 pt-3 text-xs">
                <span className="text-slate-400">
                  <span className="font-medium text-white">{fmt(c.totalPaidKobo)}</span> paid · <span className="font-medium text-white">{c.totalTriggeredCount}</span> triggers
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Budget:</span>
                  <BudgetBar used={c.totalPaidKobo} total={c.totalBudgetKobo} />
                </div>
                {c.maxCashbackPerUser > 0 && (
                  <span className="text-slate-500">Cap per user: <span className="text-slate-300">{fmt(c.maxCashbackPerUser)}</span></span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {(showCreate || editing) && (
        <CampaignFormModal
          initial={editing}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={() => { setShowCreate(false); setEditing(null); load(); }}
        />
      )}
      {analytics && <AnalyticsModal campaign={analytics} onClose={() => setAnalytics(null)} />}
    </div>
  );
}