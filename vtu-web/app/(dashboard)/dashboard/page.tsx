// vtu-web/app/(dashboard)/dashboard/page.tsx
'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Wallet, Copy, CheckCircle2, Sparkles, ArrowUpRight, ArrowDownRight,
  Smartphone, Wifi, Zap, Tv, Gift, Users, ChevronRight, Database,
  Landmark, PiggyBank, Package, Send, BookOpen, MessageSquare,
  TrendingUp, Crown, ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

// ─── Brand tokens ─────────────────────────────────────────────────────────────

const BRAND = {
  orange: '#F97316',
  orangeDark: '#EA580C',
  green: '#22C55E',
  greenDark: '#16A34A',
  text: '#111827',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',
  border: '#E5E7EB',
  surface: '#F9FAFB',
};

// ─── Mock data (replace with API data) ────────────────────────────────────────

const USER = {
  displayName: 'Chidi',
  walletBalanceKobo: 1_245_000, // ₦12,450.00
  dataBoughtTodayGB: 3.5,
  virtualAccountNumber: '8821094433',
  virtualAccountBank: 'Wema Bank',
  referralCode: 'CHIDI4U2',
  referralEarningsKobo: 18_500,
  referralCount: 7,
  subscriptionPlan: 'Free',
  hasLoan: true,
  loanBalanceKobo: 35_000_00,
  loanDueDate: '2026-06-28',
  hasBucket: true,
  bucketType: 'Data',
  bucketRemainingGB: 12.4,
  bucketTotalGB: 20,
  bucketExpiresAt: '2026-07-10',
};

const fmt = (kobo: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(kobo / 100);

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

// 90 days of mock transaction volume (kobo) — deterministic pseudo-random
function generateSeries(days: number) {
  const out: { date: string; label: string; amountKobo: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const seed = d.getDate() + d.getMonth() * 31;
    const base = 800 + (seed % 7) * 350 + (seed % 13) * 120;
    const amountKobo = base * 100 + (i % 5 === 0 ? 250000 : 0);
    out.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
      amountKobo,
    });
  }
  return out;
}

const SERIES_90 = generateSeries(90);

type RangeKey = '7d' | '30d' | '90d' | 'custom';

function getRangeData(range: RangeKey, customFrom: string, customTo: string) {
  if (range === '7d') return SERIES_90.slice(-7);
  if (range === '30d') return SERIES_90.slice(-30);
  if (range === '90d') return SERIES_90;

  // custom
  if (!customFrom || !customTo) return SERIES_90.slice(-7);
  const from = new Date(customFrom).getTime();
  const to = new Date(customTo).getTime();
  return SERIES_90.filter(d => {
    const t = new Date(d.date).getTime();
    return t >= from && t <= to;
  });
}

// ─── Quick actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { href: '/airtime', label: 'Airtime', icon: Smartphone, bg: 'rgba(249,115,22,0.10)', fg: '#F97316' },
  { href: '/data', label: 'Data', icon: Wifi, bg: 'rgba(34,197,94,0.10)', fg: '#22C55E' },
  { href: '/electricity', label: 'Electricity', icon: Zap, bg: 'rgba(251,191,36,0.14)', fg: '#D97706' },
  { href: '/cable', label: 'Cable TV', icon: Tv, bg: 'rgba(99,102,241,0.10)', fg: '#6366F1' },
  { href: '/wallet', label: 'Transfer', icon: Send, bg: 'rgba(236,72,153,0.10)', fg: '#EC4899' },
  { href: '/exam-pin', label: 'Exam Pins', icon: BookOpen, bg: 'rgba(20,184,166,0.10)', fg: '#14B8A6' },
  { href: '/sms', label: 'Bulk SMS', icon: MessageSquare, bg: 'rgba(168,85,247,0.10)', fg: '#A855F7' },
  { href: '/wallet', label: 'Fund Wallet', icon: PiggyBank, bg: 'rgba(249,115,22,0.10)', fg: '#F97316' },
];

// ─── Greeting helper ───────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Custom tooltip for chart ─────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs shadow-lg"
      style={{ background: BRAND.text, color: '#fff' }}
    >
      <p className="font-semibold">{label}</p>
      <p style={{ color: '#FDBA74' }}>{fmt(payload[0].value as number)}</p>
    </div>
  );
}

// ─── PAGE ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [copied, setCopied] = useState(false);
  const [range, setRange] = useState<RangeKey>('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const chartData = useMemo(
    () => getRangeData(range, customFrom, customTo),
    [range, customFrom, customTo]
  );

  const totalForRange = useMemo(
    () => chartData.reduce((s, d) => s + d.amountKobo, 0),
    [chartData]
  );

  const copyAccount = async () => {
    await navigator.clipboard.writeText(USER.virtualAccountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      {/* ── Greeting card ─────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 animate-fade-in-up"
        style={{ background: 'linear-gradient(135deg, #F97316 0%, #FB923C 45%, #22C55E 100%)' }}
      >
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/15 blur-3xl animate-blob" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-white/10 blur-3xl animate-blob-delayed" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white/80">{getGreeting()} 👋</p>
            <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
              Welcome back, {USER.displayName}
            </h1>
            <p className="mt-2 max-w-md text-sm text-white/85">
              Top up, pay bills, and send money — all in one place. Your wallet is ready when you are.
            </p>
          </div>

          <div className="flex shrink-0 gap-3">
            <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs text-white/75">Today's spend</p>
              <p className="mt-0.5 text-lg font-bold text-white">{fmt(chartData.at(-1)?.amountKobo ?? 0)}</p>
            </div>
            <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs text-white/75">Data today</p>
              <p className="mt-0.5 text-lg font-bold text-white">{USER.dataBoughtTodayGB} GB</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Top grid: balance, virtual account, upgrade ────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Balance card */}
        <div
          className="animate-fade-in-up rounded-3xl p-5 text-white shadow-lg [animation-delay:60ms]"
          style={{ background: 'linear-gradient(135deg, #111827, #1F2937)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: 'rgba(249,115,22,0.2)' }}>
              <Wallet className="h-5 w-5" style={{ color: BRAND.orange }} />
            </div>
            <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'rgba(34,197,94,0.2)', color: '#86EFAC' }}>
              Active
            </span>
          </div>
          <p className="mt-4 text-xs text-white/60">Wallet balance</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">{fmt(USER.walletBalanceKobo)}</p>
          <div className="mt-4 flex gap-2">
            <Link
              href="/wallet"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}
            >
              <PiggyBank className="h-4 w-4" /> Fund
            </Link>
            <Link
              href="/wallet"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/10"
            >
              <Send className="h-4 w-4" /> Transfer
            </Link>
          </div>
        </div>

        {/* Virtual account card */}
        <div
          className="animate-fade-in-up rounded-3xl border p-5 shadow-sm [animation-delay:120ms]"
          style={{ borderColor: BRAND.border, background: '#fff' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: 'rgba(34,197,94,0.10)' }}>
              <Landmark className="h-5 w-5" style={{ color: BRAND.green }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: BRAND.textFaint }}>Virtual Account</span>
          </div>

          <p className="mt-4 text-xs" style={{ color: BRAND.textMuted }}>Transfer to fund instantly</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-2xl font-extrabold tracking-tight" style={{ color: BRAND.text }}>
              {USER.virtualAccountNumber}
            </p>
            <button
              onClick={copyAccount}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition"
              style={{ background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.10)', color: copied ? BRAND.greenDark : BRAND.orange }}
            >
              {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-1 text-sm font-medium" style={{ color: BRAND.textMuted }}>{USER.virtualAccountBank}</p>

          <div className="mt-4 rounded-xl px-3 py-2 text-xs" style={{ background: BRAND.surface, color: BRAND.textMuted }}>
            Funds sent to this account number reflect in your wallet within seconds — any amount, any time.
          </div>
        </div>

        {/* Upgrade card */}
        <div
          className="animate-fade-in-up relative overflow-hidden rounded-3xl p-5 text-white shadow-lg [animation-delay:180ms] sm:col-span-2 lg:col-span-1"
          style={{ background: 'linear-gradient(150deg, #111827 0%, #1C2A18 60%, #0F2A1A 100%)' }}
        >
          <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full opacity-25 blur-3xl" style={{ background: 'radial-gradient(circle, #F97316, transparent 70%)' }} />
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: 'rgba(249,115,22,0.2)' }}>
              <Crown className="h-5 w-5" style={{ color: '#FBBF24' }} />
            </div>
            <p className="mt-4 text-xs text-white/60">Current plan</p>
            <p className="mt-1 text-2xl font-extrabold">{USER.subscriptionPlan}</p>
            <p className="mt-2 text-sm text-white/70">
              Upgrade to Pro for lower fees, higher limits, and priority support.
            </p>
            <Link
              href="/subscription"
              className="mt-4 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#fff' }}
            >
              <Sparkles className="h-4 w-4" /> Upgrade now <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Loan + Bucket + Referral row ────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Loan balance (conditional) */}
        {USER.hasLoan && (
          <div
            className="animate-fade-in-up rounded-3xl border p-5 [animation-delay:240ms]"
            style={{ borderColor: BRAND.border, background: '#fff' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: 'rgba(249,115,22,0.10)' }}>
                <Landmark className="h-5 w-5" style={{ color: BRAND.orange }} />
              </div>
              <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'rgba(239,68,68,0.10)', color: '#DC2626' }}>
                Due {fmtDate(USER.loanDueDate)}
              </span>
            </div>
            <p className="mt-4 text-xs" style={{ color: BRAND.textMuted }}>Outstanding loan balance</p>
            <p className="mt-1 text-2xl font-extrabold" style={{ color: BRAND.text }}>{fmt(USER.loanBalanceKobo)}</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: BRAND.surface }}>
              <div className="h-2 rounded-full" style={{ width: '62%', background: 'linear-gradient(90deg, #F97316, #FBBF24)' }} />
            </div>
            <p className="mt-1.5 text-xs" style={{ color: BRAND.textFaint }}>62% repaid · Auto-deducted from wallet on due date</p>
            <Link
              href="/loans"
              className="mt-3 flex items-center gap-1 text-sm font-semibold transition hover:opacity-80"
              style={{ color: BRAND.orange }}
            >
              View repayment schedule <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* Bucket balance (conditional) */}
        {USER.hasBucket && (
          <div
            className="animate-fade-in-up rounded-3xl border p-5 [animation-delay:300ms]"
            style={{ borderColor: BRAND.border, background: '#fff' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: 'rgba(34,197,94,0.10)' }}>
                <Package className="h-5 w-5" style={{ color: BRAND.green }} />
              </div>
              <span className="text-xs font-semibold" style={{ color: BRAND.textFaint }}>{USER.bucketType} Bucket</span>
            </div>
            <p className="mt-4 text-xs" style={{ color: BRAND.textMuted }}>Remaining balance</p>
            <p className="mt-1 text-2xl font-extrabold" style={{ color: BRAND.text }}>
              {USER.bucketRemainingGB} <span className="text-base font-semibold" style={{ color: BRAND.textFaint }}>/ {USER.bucketTotalGB} GB</span>
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: BRAND.surface }}>
              <div
                className="h-2 rounded-full"
                style={{ width: `${Math.round((USER.bucketRemainingGB / USER.bucketTotalGB) * 100)}%`, background: 'linear-gradient(90deg, #22C55E, #16A34A)' }}
              />
            </div>
            <p className="mt-1.5 text-xs" style={{ color: BRAND.textFaint }}>Expires {fmtDate(USER.bucketExpiresAt)}</p>
            <Link
              href="/data"
              className="mt-3 flex items-center gap-1 text-sm font-semibold transition hover:opacity-80"
              style={{ color: BRAND.green }}
            >
              Top up bucket <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* Referral card */}
        <div
          className="animate-fade-in-up relative overflow-hidden rounded-3xl p-5 text-white [animation-delay:360ms] sm:col-span-2 lg:col-span-1"
          style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}
        >
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
              <Users className="h-5 w-5 text-white" />
            </div>
            <p className="mt-4 text-xs text-white/75">Your referral code</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-2xl font-extrabold tracking-widest">{USER.referralCode}</p>
            </div>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <div>
                <p className="font-bold">{USER.referralCount}</p>
                <p className="text-xs text-white/75">Referrals</p>
              </div>
              <div className="h-8 w-px bg-white/20" />
              <div>
                <p className="font-bold">{fmt(USER.referralEarningsKobo)}</p>
                <p className="text-xs text-white/75">Earned</p>
              </div>
            </div>
            <Link
              href="/referrals"
              className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-white/20 py-2.5 text-sm font-bold transition hover:bg-white/30"
            >
              <Gift className="h-4 w-4" /> Invite &amp; earn
            </Link>
          </div>
        </div>
      </div>

      {/* ── Quick actions ───────────────────────────────────────────────────── */}
      <div
        className="animate-fade-in-up rounded-3xl border p-5 [animation-delay:420ms]"
        style={{ borderColor: BRAND.border, background: '#fff' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: BRAND.text }}>Quick actions</h2>
          <p className="text-xs" style={{ color: BRAND.textFaint }}>Tap to get started</p>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-8">
          {QUICK_ACTIONS.map((a, i) => (
            <Link
              key={a.label}
              href={a.href}
              className="group flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition hover:-translate-y-0.5 hover:shadow-md"
              style={{ animationDelay: `${460 + i * 40}ms` }}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl transition group-hover:scale-105"
                style={{ background: a.bg }}
              >
                <a.icon className="h-5 w-5" style={{ color: a.fg }} />
              </div>
              <span className="text-xs font-semibold" style={{ color: BRAND.text }}>{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Transaction bar chart ───────────────────────────────────────────── */}
      <div
        className="animate-fade-in-up rounded-3xl border p-5 [animation-delay:480ms]"
        style={{ borderColor: BRAND.border, background: '#fff' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold" style={{ color: BRAND.text }}>Transaction activity</h2>
            <p className="mt-0.5 text-sm" style={{ color: BRAND.textMuted }}>
              {fmt(totalForRange)} spent {range === 'custom' ? 'in selected range' : `in the last ${range.replace('d', ' days')}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['7d', '30d', '90d', 'custom'] as RangeKey[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
                style={
                  range === r
                    ? { background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#fff' }
                    : { background: BRAND.surface, color: BRAND.textMuted }
                }
              >
                {r === '7d' ? '7 days' : r === '30d' ? '30 days' : r === '90d' ? '90 days' : 'Custom'}
              </button>
            ))}
          </div>
        </div>

        {/* Custom range pickers */}
        {range === 'custom' && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium" style={{ color: BRAND.textMuted }}>
              From
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={e => setCustomFrom(e.target.value)}
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ border: `1.5px solid ${BRAND.border}`, color: BRAND.text }}
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-medium" style={{ color: BRAND.textMuted }}>
              To
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => setCustomTo(e.target.value)}
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ border: `1.5px solid ${BRAND.border}`, color: BRAND.text }}
              />
            </label>
            {(!customFrom || !customTo) && (
              <span className="text-xs" style={{ color: BRAND.textFaint }}>Pick both dates to see this range</span>
            )}
          </div>
        )}

        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" />
                  <stop offset="100%" stopColor="#22C55E" />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={BRAND.border} strokeDasharray="4 4" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: BRAND.textFaint }}
                axisLine={false}
                tickLine={false}
                interval={chartData.length > 14 ? Math.ceil(chartData.length / 8) : 0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: BRAND.textFaint }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₦${(v / 100000).toFixed(0)}k`}
                width={48}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(249,115,22,0.06)' }} />
              <Bar dataKey="amountKobo" fill="url(#barGradient)" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Animations ──────────────────────────────────────────────────────── */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.5s ease-out both;
        }
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -15px) scale(1.08); }
        }
        .animate-blob { animation: blob 10s ease-in-out infinite; }
        .animate-blob-delayed { animation: blob 12s ease-in-out infinite; animation-delay: 2s; }

        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in-up, .animate-blob, .animate-blob-delayed {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}