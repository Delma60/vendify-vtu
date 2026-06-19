// vtu-web/app/admin/events/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, RefreshCw, X, AlertCircle, Link2, Copy, Check,
  Gift, Coins, Users, TrendingUp, Trash2, Calendar,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type RewardType = 'wallet_credit' | 'loyalty_points' | 'badge';

interface Reward {
  type: RewardType;
  walletCreditKobo?: number;
  loyaltyPoints?: number;
  badgeId?: string;
  badgeLabel?: string;
}

interface CampaignEvent {
  id: string;
  name: string;
  description: string;
  eventKey: string;
  shareSlug: string;
  rewards: Reward[];
  userSegment: string;
  maxClaimsPerUser: number;
  maxTotalClaims: number;
  totalBudgetKobo: number;
  startDate: { _seconds: number };
  endDate: { _seconds: number };
  isActive: boolean;
  isArchived: boolean;
  totalClaimedCount: number;
  totalPaidKobo: number;
  totalPointsAwarded: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (k: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(k / 100);

const fmtDate = (s: number) =>
  new Date(s * 1000).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

const segmentLabel = (s: string) =>
  ({ all: 'Everyone', new_users: 'New users', kyc_tier_1: 'KYC tier 1+', kyc_tier_2: 'KYC tier 2+',
     plan_starter: 'Starter plan', plan_pro: 'Pro plan', plan_enterprise: 'Enterprise plan' } as Record<string, string>)[s] ?? s;

const rewardSummary = (rewards: Reward[]) =>
  rewards.map(r => {
    if (r.type === 'wallet_credit') return fmt(r.walletCreditKobo ?? 0);
    if (r.type === 'loyalty_points') return `${r.loyaltyPoints} pts`;
    return r.badgeLabel ?? r.badgeId ?? 'Badge';
  }).join(' + ');

const isLive = (e: CampaignEvent) => {
  const now = Date.now() / 1000;
  return e.isActive && !e.isArchived && now >= e.startDate._seconds && now <= e.endDate._seconds;
};

const EMPTY_REWARD: Reward = { type: 'wallet_credit', walletCreditKobo: 0 };

// ─── Shared field styles ───────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100';
const labelCls = 'mb-1.5 block text-xs font-semibold text-slate-500';

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ event }: { event: CampaignEvent }) {
  if (event.isArchived) {
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
        Archived
      </span>
    );
  }
  if (isLive(event)) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Live
      </span>
    );
  }
  const now = Date.now() / 1000;
  if (now < event.startDate._seconds) {
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
        Scheduled
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
      Ended
    </span>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function EventFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rewards, setRewards] = useState<Reward[]>([{ ...EMPTY_REWARD }]);
  const [userSegment, setUserSegment] = useState('all');
  const [maxClaimsPerUser, setMaxClaimsPerUser] = useState('1');
  const [maxTotalClaims, setMaxTotalClaims] = useState('0');
  const [totalBudgetNaira, setTotalBudgetNaira] = useState('0');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 16);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateReward = (i: number, patch: Partial<Reward>) =>
    setRewards(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addReward = () => setRewards(rs => [...rs, { ...EMPTY_REWARD }]);
  const removeReward = (i: number) => setRewards(rs => rs.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError('');
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        rewards: rewards.map(r => {
          if (r.type === 'wallet_credit') return { type: r.type, walletCreditKobo: Math.round(Number(r.walletCreditKobo ?? 0)) };
          if (r.type === 'loyalty_points') return { type: r.type, loyaltyPoints: Math.round(Number(r.loyaltyPoints ?? 0)) };
          return { type: r.type, badgeId: r.badgeId, badgeLabel: r.badgeLabel || r.badgeId };
        }),
        userSegment,
        maxClaimsPerUser: parseInt(maxClaimsPerUser, 10) || 0,
        maxTotalClaims: parseInt(maxTotalClaims, 10) || 0,
        totalBudgetKobo: Math.round(Number(totalBudgetNaira) * 100),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      };

      const res = await fetch('/api/internal/campaign-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Couldn\u2019t create this event. Try again.');
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl my-4">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">New reward link</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <label className="block">
            <span className={labelCls}>Event name</span>
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Refer a friend, June launch, etc." />
          </label>

          <label className="block">
            <span className={labelCls}>Description (shown on the public link)</span>
            <textarea className={inputCls} rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell people what they get for hopping on" />
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className={labelCls}>Rewards</span>
              <button onClick={addReward} className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700">
                <Plus className="h-3.5 w-3.5" /> Add reward
              </button>
            </div>
            <div className="space-y-2">
              {rewards.map((r, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <select
                    className={`${inputCls} max-w-[140px]`}
                    value={r.type}
                    onChange={e => updateReward(i, { type: e.target.value as RewardType })}
                  >
                    <option value="wallet_credit">Wallet credit</option>
                    <option value="loyalty_points">Loyalty points</option>
                    <option value="badge">Badge</option>
                  </select>

                  {r.type === 'wallet_credit' && (
                    <input
                      type="number" min="0" className={inputCls} placeholder="Amount (\u20a6)"
                      value={r.walletCreditKobo ? r.walletCreditKobo / 100 : ''}
                      onChange={e => updateReward(i, { walletCreditKobo: Math.round(Number(e.target.value) * 100) })}
                    />
                  )}
                  {r.type === 'loyalty_points' && (
                    <input
                      type="number" min="0" className={inputCls} placeholder="Points"
                      value={r.loyaltyPoints ?? ''}
                      onChange={e => updateReward(i, { loyaltyPoints: Number(e.target.value) })}
                    />
                  )}
                  {r.type === 'badge' && (
                    <>
                      <input className={inputCls} placeholder="badge_id" value={r.badgeId ?? ''} onChange={e => updateReward(i, { badgeId: e.target.value })} />
                      <input className={inputCls} placeholder="Display label" value={r.badgeLabel ?? ''} onChange={e => updateReward(i, { badgeLabel: e.target.value })} />
                    </>
                  )}

                  {rewards.length > 1 && (
                    <button onClick={() => removeReward(i)} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={labelCls}>Who can claim</span>
              <select className={inputCls} value={userSegment} onChange={e => setUserSegment(e.target.value)}>
                <option value="all">Everyone</option>
                <option value="new_users">New users only</option>
                <option value="kyc_tier_1">KYC tier 1+</option>
                <option value="kyc_tier_2">KYC tier 2+</option>
                <option value="plan_starter">Starter plan</option>
                <option value="plan_pro">Pro plan</option>
                <option value="plan_enterprise">Enterprise plan</option>
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Claims per user (0 = unlimited)</span>
              <input type="number" min="0" className={inputCls} value={maxClaimsPerUser} onChange={e => setMaxClaimsPerUser(e.target.value)} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={labelCls}>Total claim limit (0 = unlimited)</span>
              <input type="number" min="0" className={inputCls} value={maxTotalClaims} onChange={e => setMaxTotalClaims(e.target.value)} />
            </label>
            <label className="block">
              <span className={labelCls}>Budget cap (\u20a6, 0 = unlimited)</span>
              <input type="number" min="0" className={inputCls} value={totalBudgetNaira} onChange={e => setTotalBudgetNaira(e.target.value)} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={labelCls}>Starts</span>
              <input type="datetime-local" className={inputCls} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </label>
            <label className="block">
              <span className={labelCls}>Ends</span>
              <input type="datetime-local" className={inputCls} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name}
            className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 disabled:opacity-50"
          >
            {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
            Create event
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Share link button ────────────────────────────────────────────────────────

function ShareLinkButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/e/${slug}`;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button onClick={copy} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Link2 className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy link'}
    </button>
  );
}

// ─── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  icon, value, label, tint,
}: { icon: React.ReactNode; value: string | number; label: string; tint: 'orange' | 'green' | 'slate' }) {
  const tintCls = {
    orange: 'bg-orange-50 text-orange-600',
    green: 'bg-green-50 text-green-600',
    slate: 'bg-slate-100 text-slate-600',
  }[tint];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tintCls}`}>
        {icon}
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function AdminEventsPage() {
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/internal/campaign-events?includeArchived=${includeArchived}`);
      const data = await res.json();
      if (data.success) setEvents(data.data.events ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => { load(); }, [load]);

  const archive = async (id: string, name: string) => {
    if (!confirm(`Archive "${name}"? The link will stop accepting new claims.`)) return;
    setArchiving(id);
    await fetch(`/api/internal/campaign-events/${id}`, { method: 'DELETE' });
    setArchiving(null);
    load();
  };

  const totalActive = events.filter(isLive).length;
  const totalClaims = events.reduce((s, e) => s + e.totalClaimedCount, 0);
  const totalPaid = events.reduce((s, e) => s + e.totalPaidKobo, 0);

  return (
    <div className="min-h-screen text-slate-900">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Events</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create shareable links that reward whoever hops on \u2014 wallet credit, points, or badges.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600"
        >
          <Plus className="h-4 w-4" /> New event
        </button>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <StatCard icon={<TrendingUp className="h-5 w-5" />} value={totalActive} label="Live events" tint="orange" />
        <StatCard icon={<Users className="h-5 w-5" />} value={totalClaims} label="Total claims" tint="green" />
        <StatCard icon={<Coins className="h-5 w-5" />} value={fmt(totalPaid)} label="Wallet credit paid out" tint="slate" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-700">All events</h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-500 cursor-pointer">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={e => setIncludeArchived(e.target.checked)}
                className="rounded border-slate-300 text-orange-500 focus:ring-orange-400"
              />
              Show archived
            </label>
            <button onClick={load} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="h-7 w-7 animate-spin text-orange-400" />
          </div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center">
            <Gift className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">No events yet.</p>
            <button onClick={() => setShowForm(true)} className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">
              Create your first event
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {events.map(e => (
              <div key={e.id} className={`flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50 ${e.isArchived ? 'opacity-60' : ''}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{e.name}</p>
                    <StatusBadge event={e} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Gift className="h-3 w-3" /> {rewardSummary(e.rewards)}</span>
                    <span>{segmentLabel(e.userSegment)}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {fmtDate(e.startDate._seconds)} \u2013 {fmtDate(e.endDate._seconds)}</span>
                    <span>{e.totalClaimedCount} claimed{e.maxTotalClaims > 0 ? ` / ${e.maxTotalClaims}` : ''}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {!e.isArchived && <ShareLinkButton slug={e.shareSlug} />}
                  {!e.isArchived && (
                    <button
                      onClick={() => archive(e.id, e.name)}
                      disabled={archiving === e.id}
                      className="flex items-center gap-1.5 rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
                    >
                      {archiving === e.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      Archive
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <EventFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
}