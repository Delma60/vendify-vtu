// vtu-web/app/(dashboard)/dashboard/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Wallet,
  Copy,
  CheckCircle2,
  Sparkles,
  Smartphone,
  Wifi,
  Zap,
  Tv,
  Gift,
  Users,
  ChevronRight,
  Send,
  BookOpen,
  MessageSquare,
  PiggyBank,
  Landmark,
  Crown,
  ArrowRight,
  RefreshCw,
  Percent,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// ─── Brand tokens ─────────────────────────────────────────────────────────────

const BRAND = {
  orange: "#F97316",
  orangeDark: "#EA580C",
  green: "#22C55E",
  greenDark: "#16A34A",
  text: "#111827",
  textMuted: "#6B7280",
  textFaint: "#9CA3AF",
  border: "#E5E7EB",
  surface: "#F9FAFB",
};

// ─── Types (mirrors /api/v1/dashboard response) ───────────────────────────────

interface DashboardData {
  user: {
    displayName: string;
    email: string;
    kycTier: number;
    referralCode: string;
    hasBucket: boolean;
  };
  wallet: {
    balanceKobo: number;
    lockedBalanceKobo: number;
    virtualAccountNumber: string | null;
    virtualAccountBank: string | null;
  };
  subscription: {
    planName: string;
    isActive: boolean;
    daysRemaining: number | null;
  };
  commissions: {
    totalPendingKobo: number;
    totalCreditedKobo: number;
  };
  cashback: {
    lifetimeTotalKobo: number;
  };
  referrals: {
    count: number;
  };
  activity: {
    range: string;
    series: { date: string; label: string; amountKobo: number }[];
    totalKobo: number;
    todaySpendKobo: number;
  };
  recentTransactions: {
    id: string;
    type: "credit" | "debit";
    category: string;
    amountKobo: number;
    status: string;
    reference: string;
    createdAt: number;
  }[];
}

type RangeKey = "7d" | "30d" | "90d";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (kobo: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    kobo / 100,
  );

const fmtDateTime = (ms: number) =>
  new Date(ms).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const categoryLabel = (c: string) =>
  c.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Quick actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    href: "/airtime",
    label: "Airtime",
    icon: Smartphone,
    bg: "rgba(249,115,22,0.10)",
    fg: "#F97316",
  },
  {
    href: "/data",
    label: "Data",
    icon: Wifi,
    bg: "rgba(34,197,94,0.10)",
    fg: "#22C55E",
  },
  {
    href: "/electricity",
    label: "Electricity",
    icon: Zap,
    bg: "rgba(251,191,36,0.14)",
    fg: "#D97706",
  },
  {
    href: "/cable",
    label: "Cable TV",
    icon: Tv,
    bg: "rgba(99,102,241,0.10)",
    fg: "#6366F1",
  },
  {
    href: "/wallet",
    label: "Transfer",
    icon: Send,
    bg: "rgba(236,72,153,0.10)",
    fg: "#EC4899",
  },
  {
    href: "/exam-pin",
    label: "Exam Pins",
    icon: BookOpen,
    bg: "rgba(20,184,166,0.10)",
    fg: "#14B8A6",
  },
];

// ─── Chart tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs shadow-lg"
      style={{ background: BRAND.text, color: "#fff" }}
    >
      <p className="font-semibold">{label}</p>
      <p style={{ color: "#FDBA74" }}>{fmt(payload[0].value as number)}</p>
    </div>
  );
}

// ─── Recent transaction row ────────────────────────────────────────────────────

function TxnRow({ txn }: { txn: DashboardData["recentTransactions"][number] }) {
  const isCredit = txn.type === "credit";
  const statusColor =
    txn.status === "success"
      ? "#16A34A"
      : txn.status === "failed"
        ? "#DC2626"
        : "#D97706";

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: isCredit
              ? "rgba(34,197,94,0.10)"
              : "rgba(249,115,22,0.10)",
          }}
        >
          {isCredit ? (
            <ArrowDownRight
              className="h-4 w-4"
              style={{ color: BRAND.green }}
            />
          ) : (
            <ArrowUpRight className="h-4 w-4" style={{ color: BRAND.orange }} />
          )}
        </div>
        <div className="min-w-0">
          <p
            className="text-sm font-semibold truncate"
            style={{ color: BRAND.text }}
          >
            {categoryLabel(txn.category)}
          </p>
          <p className="text-xs" style={{ color: BRAND.textFaint }}>
            {fmtDateTime(txn.createdAt)} ·{" "}
            <span style={{ color: statusColor }}>{txn.status}</span>
          </p>
        </div>
      </div>
      <p
        className="shrink-0 text-sm font-bold"
        style={{ color: isCredit ? BRAND.greenDark : BRAND.text }}
      >
        {isCredit ? "+" : "-"}
        {fmt(txn.amountKobo)}
      </p>
    </div>
  );
}

// ─── PAGE ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [range, setRange] = useState<RangeKey>("7d");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (r: RangeKey) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/dashboard?range=${r}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [load, range]);

  const copyAccount = async () => {
    if (!data?.wallet.virtualAccountNumber) return;
    await navigator.clipboard.writeText(data.wallet.virtualAccountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <RefreshCw
          className="h-8 w-8 animate-spin"
          style={{ color: BRAND.orange }}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <p className="text-sm" style={{ color: BRAND.textMuted }}>
          Couldn't load your dashboard.
        </p>
        <button
          onClick={() => load(range)}
          className="mt-3 rounded-xl px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
        >
          Try again
        </button>
      </div>
    );
  }

  const {
    user,
    wallet,
    subscription,
    commissions,
    cashback,
    referrals,
    activity,
    recentTransactions,
  } = data;

  return (
    <div className="mx-auto max-w-7xl pb-10">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-medium" style={{ color: BRAND.textFaint }}>
            {getGreeting()} 👋
          </p>
          <h1
            className="mt-0.5 text-2xl font-extrabold sm:text-3xl"
            style={{ color: BRAND.text }}
          >
            {user.displayName}
          </h1>
        </div>
        <p className="text-xs" style={{ color: BRAND.textFaint }}>
          {new Date().toLocaleDateString("en-NG", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* ── Main two-column layout ────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* ── LEFT: balance hero + activity ──────────────────────────────── */}
        <div className="space-y-5">
          {/* Balance hero */}
          <div
            className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white"
            style={{
              background:
                "linear-gradient(135deg, #111827 0%, #1F2937 55%, #14361F 100%)",
            }}
          >
            <div
              className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full opacity-25 blur-3xl"
              style={{
                background: "radial-gradient(circle, #F97316, transparent 70%)",
              }}
            />
            <div
              className="pointer-events-none absolute -bottom-20 left-10 h-56 w-56 rounded-full opacity-20 blur-3xl"
              style={{
                background: "radial-gradient(circle, #22C55E, transparent 70%)",
              }}
            />

            <div className="relative flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-white/70" />
                  <p className="text-xs text-white/70">Wallet balance</p>
                </div>
                <p className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
                  {fmt(wallet.balanceKobo)}
                </p>
                {wallet.lockedBalanceKobo > 0 && (
                  <p className="mt-1.5 text-xs text-white/60">
                    {fmt(wallet.lockedBalanceKobo)} locked (pending disputes)
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Link
                  href="/wallet"
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition hover:opacity-90"
                  style={{
                    background: "linear-gradient(135deg, #F97316, #EA580C)",
                  }}
                >
                  <PiggyBank className="h-4 w-4" /> Fund
                </Link>
                <Link
                  href="/wallet"
                  className="flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  <Send className="h-4 w-4" /> Transfer
                </Link>
              </div>
            </div>

            {/* Virtual account strip */}
            {wallet.virtualAccountNumber && (
              <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                    <Landmark className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-white/60">
                      Fund instantly via transfer
                    </p>
                    <p className="text-sm font-bold tracking-wide">
                      {wallet.virtualAccountNumber}{" "}
                      <span className="font-medium text-white/70">
                        · {wallet.virtualAccountBank}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={copyAccount}
                  className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25"
                >
                  {copied ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </div>

          {/* Activity chart */}
          <div
            className="rounded-3xl border p-5"
            style={{ borderColor: BRAND.border, background: "#fff" }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2
                  className="text-base font-bold"
                  style={{ color: BRAND.text }}
                >
                  Spending activity
                </h2>
                <p
                  className="mt-0.5 text-sm"
                  style={{ color: BRAND.textMuted }}
                >
                  {fmt(activity.totalKobo)} spent in the last{" "}
                  {range.replace("d", " days")}
                  {" · "}
                  {fmt(activity.todaySpendKobo)} today
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(["7d", "30d", "90d"] as RangeKey[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
                    style={
                      range === r
                        ? {
                            background:
                              "linear-gradient(135deg, #F97316, #EA580C)",
                            color: "#fff",
                          }
                        : { background: BRAND.surface, color: BRAND.textMuted }
                    }
                  >
                    {r.replace("d", " days")}
                  </button>
                ))}
                {loading && (
                  <RefreshCw
                    className="h-3.5 w-3.5 animate-spin"
                    style={{ color: BRAND.textFaint }}
                  />
                )}
              </div>
            </div>

            <div className="mt-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={activity.series}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="activityFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#F97316"
                        stopOpacity={0.35}
                      />
                      <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke={BRAND.border}
                    strokeDasharray="4 4"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: BRAND.textFaint }}
                    axisLine={false}
                    tickLine={false}
                    interval={
                      activity.series.length > 14
                        ? Math.ceil(activity.series.length / 8)
                        : 0
                    }
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: BRAND.textFaint }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₦${(v / 100000).toFixed(0)}k`}
                    width={48}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="amountKobo"
                    stroke="#F97316"
                    strokeWidth={2.5}
                    fill="url(#activityFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent transactions */}
          <div
            className="rounded-3xl border p-5"
            style={{ borderColor: BRAND.border, background: "#fff" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ color: BRAND.text }}>
                Recent transactions
              </h2>
              <Link
                href="/transactions"
                className="flex items-center gap-1 text-sm font-semibold"
                style={{ color: BRAND.orange }}
              >
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="py-10 text-center">
                <Clock
                  className="mx-auto h-8 w-8"
                  style={{ color: BRAND.textFaint }}
                />
                <p className="mt-2 text-sm" style={{ color: BRAND.textMuted }}>
                  No transactions yet.
                </p>
              </div>
            ) : (
              <div
                className="mt-1 divide-y"
                style={{ borderColor: BRAND.border }}
              >
                {recentTransactions.map((txn) => (
                  <TxnRow key={txn.id} txn={txn} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: quick actions + account info rail ───────────────────── */}
        <div className="space-y-5">
          {/* Quick actions */}
          <div
            className="rounded-3xl border p-5"
            style={{ borderColor: BRAND.border, background: "#fff" }}
          >
            <h2 className="text-sm font-bold" style={{ color: BRAND.text }}>
              Quick actions
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {QUICK_ACTIONS.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className="flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-2xl"
                    style={{ background: a.bg }}
                  >
                    <a.icon className="h-4.5 w-4.5" style={{ color: a.fg }} />
                  </div>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: BRAND.text }}
                  >
                    {a.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Subscription */}
          <div
            className="relative overflow-hidden rounded-3xl p-5 text-white"
            style={{
              background:
                "linear-gradient(150deg, #111827 0%, #1C2A18 60%, #0F2A1A 100%)",
            }}
          >
            <div
              className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-25 blur-3xl"
              style={{
                background: "radial-gradient(circle, #F97316, transparent 70%)",
              }}
            />
            <div className="relative">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-2xl"
                style={{ background: "rgba(249,115,22,0.2)" }}
              >
                <Crown className="h-4.5 w-4.5" style={{ color: "#FBBF24" }} />
              </div>
              <p className="mt-3 text-xs text-white/60">Current plan</p>
              <p className="mt-0.5 text-xl font-extrabold">
                {subscription.planName}
              </p>
              {subscription.daysRemaining !== null ? (
                <p className="mt-1 text-xs text-white/70">
                  {subscription.daysRemaining} day(s) remaining
                </p>
              ) : (
                <p className="mt-1 text-xs text-white/70">
                  No active billing cycle
                </p>
              )}
              <Link
                href="/subscription"
                className="mt-4 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition hover:opacity-90"
                style={{
                  background: "linear-gradient(135deg, #F97316, #EA580C)",
                  color: "#fff",
                }}
              >
                <Sparkles className="h-4 w-4" /> Manage plan{" "}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Referrals */}
          <div
            className="relative overflow-hidden rounded-3xl p-5 text-white"
            style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)" }}
          >
            <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/20">
                <Users className="h-4.5 w-4.5 text-white" />
              </div>
              <p className="mt-3 text-xs text-white/75">Your referral code</p>
              <p className="text-xl font-extrabold tracking-widest">
                {user.referralCode}
              </p>
              <p className="mt-2 text-sm text-white/85">
                {referrals.count} referral{referrals.count !== 1 ? "s" : ""}
              </p>
              <Link
                href="/referrals"
                className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-white/20 py-2.5 text-sm font-bold transition hover:bg-white/30"
              >
                <Gift className="h-4 w-4" /> Invite &amp; earn
              </Link>
            </div>
          </div>

          {/* Earnings summary */}
          <div
            className="rounded-3xl border p-5"
            style={{ borderColor: BRAND.border, background: "#fff" }}
          >
            <h2 className="text-sm font-bold" style={{ color: BRAND.text }}>
              Earnings
            </h2>
            <div className="mt-3 space-y-3">
              <div
                className="flex items-center justify-between rounded-2xl px-3 py-2.5"
                style={{ background: BRAND.surface }}
              >
                <div className="flex items-center gap-2.5">
                  <TrendingUp
                    className="h-4 w-4"
                    style={{ color: BRAND.orange }}
                  />
                  <span className="text-sm" style={{ color: BRAND.textMuted }}>
                    Commissions pending
                  </span>
                </div>
                <span
                  className="text-sm font-bold"
                  style={{ color: BRAND.text }}
                >
                  {fmt(commissions.totalPendingKobo)}
                </span>
              </div>
              <div
                className="flex items-center justify-between rounded-2xl px-3 py-2.5"
                style={{ background: BRAND.surface }}
              >
                <div className="flex items-center gap-2.5">
                  <Percent className="h-4 w-4" style={{ color: BRAND.green }} />
                  <span className="text-sm" style={{ color: BRAND.textMuted }}>
                    Commissions earned
                  </span>
                </div>
                <span
                  className="text-sm font-bold"
                  style={{ color: BRAND.text }}
                >
                  {fmt(commissions.totalCreditedKobo)}
                </span>
              </div>
              <div
                className="flex items-center justify-between rounded-2xl px-3 py-2.5"
                style={{ background: BRAND.surface }}
              >
                <div className="flex items-center gap-2.5">
                  <Gift className="h-4 w-4" style={{ color: "#A855F7" }} />
                  <span className="text-sm" style={{ color: BRAND.textMuted }}>
                    Cashback earned
                  </span>
                </div>
                <span
                  className="text-sm font-bold"
                  style={{ color: BRAND.text }}
                >
                  {fmt(cashback.lifetimeTotalKobo)}
                </span>
              </div>
            </div>
            {commissions.totalPendingKobo > 0 && (
              <Link
                href="/commissions"
                className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border py-2 text-sm font-semibold transition hover:bg-gray-50"
                style={{ borderColor: BRAND.border, color: BRAND.text }}
              >
                Withdraw commissions <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
