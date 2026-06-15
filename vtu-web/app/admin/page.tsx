// vtu-web/app/admin/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Activity,
  Shield,
  Radio,
  HardDrive,
  BarChart3,
  Smartphone,
  Wifi,
  Tv,
  BookOpen,
} from 'lucide-react';

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const B = {
  orange: '#F97316',
  orangeLight: 'rgba(249,115,22,0.1)',
  orangeDark: '#EA580C',
  green: '#22C55E',
  greenLight: 'rgba(34,197,94,0.1)',
  red: '#EF4444',
  redLight: 'rgba(239,68,68,0.1)',
  blue: '#3B82F6',
  blueLight: 'rgba(59,130,246,0.1)',
  purple: '#8B5CF6',
  purpleLight: 'rgba(139,92,246,0.1)',
  amber: '#F59E0B',
  amberLight: 'rgba(245,158,11,0.1)',
  text: '#111827',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',
  border: '#E5E7EB',
  surface: '#F9FAFB',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface StatCard {
  label: string;
  value: string;
  sub: string;
  trend: number; // positive = up, negative = down
  icon: React.ElementType;
  color: string;
  bg: string;
}

interface RecentTransaction {
  id: string;
  user: string;
  service: string;
  amount: string;
  status: 'success' | 'failed' | 'pending';
  time: string;
  serviceIcon: React.ElementType;
}

interface ProviderStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: string;
  uptime: string;
}

interface QuickAction {
  label: string;
  desc: string;
  href: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

// ─── Mock data (replace with real API calls) ──────────────────────────────────
const STATS: StatCard[] = [
  {
    label: 'Total Revenue',
    value: '₦4,821,340',
    sub: 'This month',
    trend: 12.4,
    icon: DollarSign,
    color: B.orange,
    bg: B.orangeLight,
  },
  {
    label: 'Active Users',
    value: '12,847',
    sub: 'Registered accounts',
    trend: 8.1,
    icon: Users,
    color: B.blue,
    bg: B.blueLight,
  },
  {
    label: 'Transactions',
    value: '38,291',
    sub: 'Last 30 days',
    trend: 5.7,
    icon: CreditCard,
    color: B.green,
    bg: B.greenLight,
  },
  {
    label: 'Fraud Flags',
    value: '23',
    sub: 'Pending review',
    trend: -14.2,
    icon: Shield,
    color: B.red,
    bg: B.redLight,
  },
];

const RECENT_TXN: RecentTransaction[] = [
  { id: 'VTX-AIR-001', user: 'Chidi Okeke', service: 'Airtime', amount: '₦2,000', status: 'success', time: '2 min ago', serviceIcon: Smartphone },
  { id: 'VTX-DAT-002', user: 'Fatima Bello', service: 'Data', amount: '₦1,500', status: 'success', time: '5 min ago', serviceIcon: Wifi },
  { id: 'VTX-ELE-003', user: 'Emeka Nwosu', service: 'Electricity', amount: '₦10,000', status: 'pending', time: '8 min ago', serviceIcon: Zap },
  { id: 'VTX-CAB-004', user: 'Ngozi Adeyemi', service: 'Cable TV', amount: '₦4,900', status: 'failed', time: '12 min ago', serviceIcon: Tv },
  { id: 'VTX-DAT-005', user: 'Sule Garba', service: 'Data', amount: '₦500', status: 'success', time: '15 min ago', serviceIcon: Wifi },
  { id: 'VTX-PIN-006', user: 'Amaka Obi', service: 'Exam Pin', amount: '₦3,500', status: 'success', time: '18 min ago', serviceIcon: BookOpen },
];

const PROVIDERS: ProviderStatus[] = [
  { name: 'Bilal VTU', status: 'healthy', latency: '142ms', uptime: '99.8%' },
  { name: 'SimhostNG', status: 'healthy', latency: '201ms', uptime: '99.5%' },
  { name: 'Ogdams', status: 'degraded', latency: '890ms', uptime: '97.2%' },
  { name: 'Flutterwave', status: 'healthy', latency: '98ms', uptime: '99.9%' },
];

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Manage Users', desc: 'View, suspend, verify KYC', href: '/admin/users', icon: Users, color: B.blue, bg: B.blueLight },
  { label: 'Review Fraud', desc: '23 transactions flagged', href: '/admin/fraud', icon: Shield, color: B.red, bg: B.redLight },
  { label: 'DLQ Entries', desc: '5 stuck transactions', href: '/admin/dlq', icon: HardDrive, color: B.amber, bg: B.amberLight },
  { label: 'Provider Config', desc: 'Routing & float levels', href: '/admin/providers', icon: Radio, color: B.purple, bg: B.purpleLight },
];

// ─── Bar chart (pure CSS, no external dep) ───────────────────────────────────
const CHART_DATA = [
  { day: 'Mon', value: 68 },
  { day: 'Tue', value: 82 },
  { day: 'Wed', value: 74 },
  { day: 'Thu', value: 91 },
  { day: 'Fri', value: 87 },
  { day: 'Sat', value: 53 },
  { day: 'Sun', value: 45 },
];

const SERVICE_SPLIT = [
  { label: 'Data', pct: 38, color: B.blue },
  { label: 'Airtime', pct: 27, color: B.orange },
  { label: 'Electricity', pct: 19, color: B.green },
  { label: 'Cable', pct: 9, color: B.purple },
  { label: 'Other', pct: 7, color: B.textFaint },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusColor(s: RecentTransaction['status']) {
  if (s === 'success') return { text: B.green, bg: B.greenLight, label: 'Success' };
  if (s === 'failed') return { text: B.red, bg: B.redLight, label: 'Failed' };
  return { text: B.amber, bg: B.amberLight, label: 'Pending' };
}

function providerDot(s: ProviderStatus['status']) {
  if (s === 'healthy') return B.green;
  if (s === 'degraded') return B.amber;
  return B.red;
}

function providerLabel(s: ProviderStatus['status']) {
  if (s === 'healthy') return 'Healthy';
  if (s === 'degraded') return 'Degraded';
  return 'Down';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-white ${className}`}
      style={{ border: `1px solid ${B.border}` }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ title, action, href }: { title: string; action?: string; href?: string }) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-3">
      <h2 className="text-sm font-bold" style={{ color: B.text }}>{title}</h2>
      {action && href && (
        <Link
          href={href}
          className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70"
          style={{ color: B.orange }}
        >
          {action}
          <ChevronRight size={13} />
        </Link>
      )}
    </div>
  );
}

function StatCardItem({ card }: { card: StatCard }) {
  const Icon = card.icon;
  const up = card.trend >= 0;
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: card.bg }}
        >
          <Icon size={18} style={{ color: card.color }} strokeWidth={2} />
        </div>
        <span
          className="flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-bold"
          style={{ background: up ? B.greenLight : B.redLight, color: up ? B.green : B.red }}
        >
          {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(card.trend)}%
        </span>
      </div>
      <p className="text-2xl font-extrabold tracking-tight" style={{ color: B.text }}>{card.value}</p>
      <p className="mt-0.5 text-sm font-medium" style={{ color: B.textMuted }}>{card.label}</p>
      <p className="mt-0.5 text-xs" style={{ color: B.textFaint }}>{card.sub}</p>
    </Card>
  );
}

function TxnStatusIcon({ status }: { status: RecentTransaction['status'] }) {
  if (status === 'success') return <CheckCircle2 size={14} style={{ color: B.green }} />;
  if (status === 'failed') return <XCircle size={14} style={{ color: B.red }} />;
  return <Clock size={14} style={{ color: B.amber }} />;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<StatCard[]>(STATS);
  const [recent, setRecent] = useState<RecentTransaction[]>(RECENT_TXN);
  const [providers, setProviders] = useState<ProviderStatus[]>(PROVIDERS);

  function formatKobo(kobo: number | null | undefined) {
    if (!kobo && kobo !== 0) return '—';
    return `₦${(kobo! / 100).toLocaleString('en-NG')}`;
  }

  function minutesAgo(ts: number) {
    const diff = Math.floor((Date.now() - ts) / 60000);
    if (diff <= 0) return 'just now';
    if (diff === 1) return '1 min ago';
    if (diff < 60) return `${diff} min ago`;
    const hours = Math.floor(diff / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hrs ago`;
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/dashboard');
      const json = await res.json();
      if (!json || !json.success) throw new Error(json?.message || 'Failed to load');
      const d = json.data;

      const mappedStats: StatCard[] = [
        {
          label: 'Total Revenue',
          value: formatKobo(d.wallet?.balanceKobo),
          sub: 'Current balance',
          trend: 0,
          icon: DollarSign,
          color: B.orange,
          bg: B.orangeLight,
        },
        {
          label: 'Commissions',
          value: formatKobo(d.commissions?.totalCreditedKobo),
          sub: 'Total credited',
          trend: 0,
          icon: TrendingUp,
          color: B.blue,
          bg: B.blueLight,
        },
        {
          label: 'Transactions',
          value: formatKobo(d.activity?.totalKobo),
          sub: `Last ${d.activity?.range ?? '7d'}`,
          trend: 0,
          icon: CreditCard,
          color: B.green,
          bg: B.greenLight,
        },
        {
          label: 'Cashback (lifetime)',
          value: formatKobo(d.cashback?.lifetimeTotalKobo),
          sub: 'Total paid out',
          trend: 0,
          icon: Shield,
          color: B.red,
          bg: B.redLight,
        },
      ];

      setStats(mappedStats);

      const mappedRecent: RecentTransaction[] = (d.recentTransactions || []).map((t: any) => ({
        id: t.reference || t.id,
        user: d.user?.displayName || 'Unknown',
        service: t.category || t.type || '—',
        amount: formatKobo(t.amountKobo),
        status: t.status || 'pending',
        time: minutesAgo(t.createdAt),
        serviceIcon: t.category === 'data' ? Wifi : t.category === 'airtime' ? Smartphone : t.category === 'electricity' ? Zap : t.category === 'cable' ? Tv : BookOpen,
      }));

      setRecent(mappedRecent);

      // Providers & other system-level values can come from the API later
      if (d.providers) setProviders(d.providers);

      setLastUpdated(new Date());
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to fetch');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  React.useEffect(() => {
    load();
  }, []);

  const maxChart = Math.max(...CHART_DATA.map((d) => d.value));

  return (
    <div className="min-h-full space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight" style={{ color: B.text }}>
            Good morning, Admin 👋
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: B.textMuted }}>
            Here's what's happening on VendPro today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs" style={{ color: B.textFaint }}>
            Updated {lastUpdated.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
            style={{ border: `1.5px solid ${B.border}`, color: B.textMuted, background: '#fff' }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <p className="text-sm text-muted">Loading dashboard…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          stats.map((card) => (
            <StatCardItem key={card.label} card={card} />
          ))
        )}
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Weekly transaction volume bar chart */}
        <Card className="lg:col-span-2">
          <SectionHeader title="Transaction volume — this week" />
          <div className="px-5 pb-5">
            <div className="flex items-end gap-2 h-36">
              {CHART_DATA.map((d) => {
                const pct = (d.value / maxChart) * 100;
                return (
                  <div key={d.day} className="group flex flex-1 flex-col items-center gap-1.5">
                    <span
                      className="text-[10px] font-bold opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: B.orange }}
                    >
                      {d.value}k
                    </span>
                    <div className="relative w-full rounded-t-lg overflow-hidden" style={{ height: `${pct}%`, minHeight: 4 }}>
                      <div
                        className="absolute inset-0 rounded-t-lg transition-all duration-500"
                        style={{ background: `linear-gradient(to top, #F97316, #FBBF24)` }}
                      />
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: B.textFaint }}>{d.day}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Service split */}
        <Card>
          <SectionHeader title="Revenue by service" />
          <div className="px-5 pb-5 space-y-3">
            {SERVICE_SPLIT.map((s) => (
              <div key={s.label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: B.textMuted }}>{s.label}</span>
                  <span className="text-xs font-bold" style={{ color: B.text }}>{s.pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: B.surface }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${s.pct}%`, background: s.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Middle row: recent txns + quick actions ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Recent transactions */}
        <Card className="lg:col-span-2">
          <SectionHeader title="Recent transactions" action="View all" href="/admin/transactions" />
          <div className="divide-y" style={{ borderColor: B.border }}>
            {recent.length === 0 && (
              <p className="p-4 text-sm text-gray-500">No recent transactions</p>
            )}
            {recent.map((txn) => {
              const sc = statusColor(txn.status);
              const SvcIcon = txn.serviceIcon;
              return (
                <div key={txn.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50">
                  {/* Service icon */}
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: B.orangeLight }}
                  >
                    <SvcIcon size={15} style={{ color: B.orange }} strokeWidth={2} />
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold" style={{ color: B.text }}>{txn.user}</p>
                      <span className="hidden shrink-0 text-xs sm:block" style={{ color: B.textFaint }}>·</span>
                      <p className="hidden shrink-0 text-xs sm:block" style={{ color: B.textFaint }}>{txn.service}</p>
                    </div>
                    <p className="text-xs" style={{ color: B.textFaint }}>{txn.id} · {txn.time}</p>
                  </div>

                  {/* Amount */}
                  <p className="shrink-0 text-sm font-bold" style={{ color: B.text }}>{txn.amount}</p>

                  {/* Status */}
                  <div
                    className="ml-1 flex shrink-0 items-center gap-1 rounded-lg px-2 py-1"
                    style={{ background: sc.bg }}
                  >
                    <TxnStatusIcon status={txn.status} />
                    <span className="hidden text-[11px] font-bold sm:block" style={{ color: sc.text }}>{sc.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Quick actions */}
        <div className="flex flex-col gap-4">
          <Card>
            <SectionHeader title="Quick actions" />
            <div className="px-4 pb-4 space-y-2">
              {QUICK_ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="flex items-center gap-3 rounded-xl p-3 transition-all hover:shadow-sm active:scale-[0.99]"
                    style={{ border: `1px solid ${B.border}` }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: a.bg }}
                    >
                      <Icon size={16} style={{ color: a.color }} strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold" style={{ color: B.text }}>{a.label}</p>
                      <p className="text-xs" style={{ color: B.textFaint }}>{a.desc}</p>
                    </div>
                    <ChevronRight size={15} className="ml-auto shrink-0" style={{ color: B.textFaint }} />
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Bottom row: provider health + DLQ alert ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Provider health */}
        <Card>
          <SectionHeader title="Provider health" action="Configure" href="/admin/providers" />
          <div className="divide-y px-5 pb-2" style={{ borderColor: B.border }}>
            {PROVIDERS.map((p) => (
              <div key={p.name} className="flex items-center gap-4 py-3">
                {/* Dot */}
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: providerDot(p.status) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold" style={{ color: B.text }}>{p.name}</p>
                  <p className="text-xs" style={{ color: B.textFaint }}>Uptime: {p.uptime}</p>
                </div>
                <div className="text-right">
                  <p
                    className="text-xs font-bold"
                    style={{ color: providerDot(p.status) }}
                  >
                    {providerLabel(p.status)}
                  </p>
                  <p className="text-xs" style={{ color: B.textFaint }}>{p.latency}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* System status strip */}
        <Card>
          <SectionHeader title="System at a glance" />
          <div className="grid grid-cols-2 gap-3 px-5 pb-5">
            {[
              { label: 'Pending withdrawals', value: '₦312,000', icon: DollarSign, color: B.amber, bg: B.amberLight },
              { label: 'Open support tickets', value: '17', icon: Activity, color: B.blue, bg: B.blueLight },
              { label: 'DLQ entries', value: '5', icon: HardDrive, color: B.red, bg: B.redLight },
              { label: 'New KYC requests', value: '31', icon: Users, color: B.green, bg: B.greenLight },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-xl p-3.5"
                  style={{ background: item.bg }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Icon size={14} style={{ color: item.color }} strokeWidth={2.2} />
                    <span className="text-[11px] font-semibold" style={{ color: item.color }}>{item.label}</span>
                  </div>
                  <p className="text-xl font-extrabold" style={{ color: B.text }}>{item.value}</p>
                </div>
              );
            })}
          </div>

          {/* Mini alert banner if degraded provider */}
          {PROVIDERS.some((p) => p.status !== 'healthy') && (
            <div
              className="mx-5 mb-5 flex items-start gap-3 rounded-xl p-3.5"
              style={{ background: B.amberLight, border: `1px solid ${B.amber}30` }}
            >
              <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: B.amber }} />
              <div>
                <p className="text-xs font-bold" style={{ color: '#92400E' }}>Provider degraded</p>
                <p className="text-xs" style={{ color: '#B45309' }}>
                  Ogdams is experiencing high latency. Traffic has been rerouted to Bilal.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}