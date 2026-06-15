// vtu-web/app/admin/providers/floats/page.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Landmark,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  PlusCircle,
  Activity,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  History,
  Settings2,
} from "lucide-react";

// ─── Brand tokens ──────────────────────────────────────────────────────────────
const B = {
  orange: "#F97316",
  orangeDark: "#EA580C",
  orangeLight: "rgba(249,115,22,0.10)",
  green: "#22C55E",
  greenLight: "rgba(34,197,94,0.10)",
  red: "#EF4444",
  redLight: "rgba(239,68,68,0.10)",
  amber: "#F59E0B",
  amberLight: "rgba(245,158,11,0.10)",
  blue: "#3B82F6",
  blueLight: "rgba(59,130,246,0.10)",
  text: "#111827",
  textMuted: "#6B7280",
  textFaint: "#9CA3AF",
  border: "#E5E7EB",
  surface: "#F9FAFB",
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface FloatRecord {
  providerId: string;
  providerName: string;
  providerCode: string;
  balanceKobo: number;
  lowThresholdKobo: number;
  autoFundEnabled: boolean;
  autoFundAmountKobo: number;
  lastCheckedAt: { _seconds: number } | null;
  lastFundedAt: { _seconds: number } | null;
  isLow: boolean;
  isActive: boolean;
}

interface FloatSummary {
  totalBalanceKobo: number;
  lowCount: number;
  autoFundCount: number;
  totalProviders: number;
  activeProviders: number;
}

interface HistoryEntry {
  id: string;
  type: "check" | "auto_fund" | "manual_fund" | "alert";
  previousBalanceKobo: number;
  newBalanceKobo: number | null;
  amountKobo: number | null;
  note: string;
  triggeredBy: "system" | "admin";
  createdAt: { _seconds: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fromNaira(naira: string): number {
  const n = parseFloat(naira.replace(/,/g, ""));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

function tsToDate(ts: { _seconds: number } | null): string {
  if (!ts) return "Never";
  const d = new Date(ts._seconds * 1000);
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(ts: { _seconds: number } | null): string {
  if (!ts) return "—";
  const diffMs = Date.now() - ts._seconds * 1000;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function historyTypeLabel(type: HistoryEntry["type"]) {
  switch (type) {
    case "check":
      return { label: "Balance Check", color: B.blue, bg: B.blueLight };
    case "auto_fund":
      return { label: "Auto-Fund", color: B.green, bg: B.greenLight };
    case "manual_fund":
      return { label: "Manual Top-up", color: B.orange, bg: B.orangeLight };
    case "alert":
      return { label: "Alert Sent", color: B.amber, bg: B.amberLight };
  }
}

// ─── UI primitives ─────────────────────────────────────────────────────────────
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-white ${className}`}
      style={{ border: `1px solid ${B.border}` }}
    >
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="flex items-center transition-all active:scale-95 disabled:opacity-40"
    >
      {checked ? (
        <ToggleRight size={28} style={{ color: B.green }} strokeWidth={2} />
      ) : (
        <ToggleLeft size={28} style={{ color: B.textFaint }} strokeWidth={2} />
      )}
    </button>
  );
}

// ─── Fund modal ────────────────────────────────────────────────────────────────
function ManualFundModal({
  provider,
  onClose,
  onDone,
}: {
  provider: FloatRecord;
  onClose: () => void;
  onDone: (newBalance: number) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const kobo = fromNaira(amount);
    if (kobo <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/providers/floats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fund",
          providerId: provider.providerId,
          amountKobo: kobo,
          note: note || "Manual top-up",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      onDone(provider.balanceKobo + kobo);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        style={{ border: `1px solid ${B.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-base font-bold" style={{ color: B.text }}>
          Record top-up — {provider.providerName}
        </h2>
        <p className="mb-4 text-xs" style={{ color: B.textFaint }}>
          This records a manual bank transfer you've already made to the
          provider. Current balance: {fmt(provider.balanceKobo)}.
        </p>

        {error && (
          <div
            className="mb-4 rounded-xl px-4 py-3 text-sm"
            style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#DC2626",
            }}
          >
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label
              className="mb-1 block text-xs font-semibold"
              style={{ color: B.textMuted }}
            >
              Amount (₦) <span style={{ color: B.red }}>*</span>
            </label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 50000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: B.border, color: B.text }}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-semibold"
              style={{ color: B.textMuted }}
            >
              Note (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. GTBank transfer, ref #1234"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: B.border, color: B.text }}
            />
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold transition"
            style={{ border: `1.5px solid ${B.border}`, color: B.text }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || !amount}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-white transition-all disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
            }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Recording…" : "Record top-up"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Settings panel ────────────────────────────────────────────────────────────
function FloatSettingsPanel({
  record,
  onSave,
}: {
  record: FloatRecord;
  onSave: (updated: Partial<FloatRecord>) => void;
}) {
  const [threshold, setThreshold] = useState(
    String(record.lowThresholdKobo / 100)
  );
  const [autoFund, setAutoFund] = useState(record.autoFundEnabled);
  const [autoAmount, setAutoAmount] = useState(
    String(record.autoFundAmountKobo / 100)
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/internal/providers/floats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: record.providerId,
          lowThresholdKobo: fromNaira(threshold),
          autoFundEnabled: autoFund,
          autoFundAmountKobo: fromNaira(autoAmount),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      onSave({
        lowThresholdKobo: fromNaira(threshold),
        autoFundEnabled: autoFund,
        autoFundAmountKobo: fromNaira(autoAmount),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="space-y-4 rounded-xl p-4"
      style={{ background: B.surface, border: `1px solid ${B.border}` }}
    >
      <p className="text-xs font-bold" style={{ color: B.textMuted }}>
        Alert & auto-fund settings
      </p>

      {error && (
        <p className="text-xs" style={{ color: B.red }}>
          {error}
        </p>
      )}

      {/* Low threshold */}
      <div>
        <label
          className="mb-1 block text-xs font-semibold"
          style={{ color: B.textMuted }}
        >
          Alert threshold (₦)
        </label>
        <p className="mb-1.5 text-[11px]" style={{ color: B.textFaint }}>
          Send alert when balance drops below this amount
        </p>
        <input
          type="number"
          min="0"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-1"
          style={{
            borderColor: B.border,
            color: B.text,
            background: "#fff",
          }}
        />
      </div>

      {/* Auto-fund toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold" style={{ color: B.text }}>
            Enable auto-fund
          </p>
          <p className="text-[11px]" style={{ color: B.textFaint }}>
            Automatically top up when balance is low
          </p>
        </div>
        <Toggle
          checked={autoFund}
          onChange={setAutoFund}
          disabled={saving}
        />
      </div>

      {/* Auto-fund amount — only shown if enabled */}
      {autoFund && (
        <div>
          <label
            className="mb-1 block text-xs font-semibold"
            style={{ color: B.textMuted }}
          >
            Auto-fund amount (₦)
          </label>
          <input
            type="number"
            min="0"
            value={autoAmount}
            onChange={(e) => setAutoAmount(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-1"
            style={{
              borderColor: B.border,
              color: B.text,
              background: "#fff",
            }}
          />
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-60"
        style={{
          background: saved
            ? `linear-gradient(135deg, ${B.green}, #16A34A)`
            : `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
        }}
      >
        {saving ? (
          <Loader2 size={12} className="animate-spin" />
        ) : saved ? (
          <CheckCircle2 size={12} />
        ) : (
          <Settings2 size={12} />
        )}
        {saving ? "Saving…" : saved ? "Saved!" : "Save settings"}
      </button>
    </div>
  );
}

// ─── Float provider card ───────────────────────────────────────────────────────
function FloatCard({
  record: initialRecord,
  onFundClick,
}: {
  record: FloatRecord;
  onFundClick: (r: FloatRecord) => void;
}) {
  const [record, setRecord] = useState(initialRecord);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"settings" | "history">(
    "settings"
  );
  const [syncing, setSyncing] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const pct = record.lowThresholdKobo > 0
    ? Math.min(100, (record.balanceKobo / record.lowThresholdKobo) * 100)
    : 100;

  const barColor =
    pct >= 100
      ? B.green
      : pct >= 50
        ? B.amber
        : B.red;

  async function syncBalance() {
    setSyncing(true);
    try {
      const res = await fetch("/api/internal/providers/floats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync",
          providerId: record.providerId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setRecord((r) => ({
          ...r,
          balanceKobo: json.data.balanceKobo,
          isLow: json.data.balanceKobo < r.lowThresholdKobo,
          lastCheckedAt: { _seconds: Math.floor(Date.now() / 1000) },
        }));
      }
    } catch {}
    setSyncing(false);
  }

  async function loadHistory() {
    if (history) return; // already loaded
    setLoadingHistory(true);
    try {
      const res = await fetch(
        `/api/internal/providers/floats?providerId=${record.providerId}&historyOnly=true`
      );
      const json = await res.json();
      if (json.success) setHistory(json.data.history);
    } catch {}
    setLoadingHistory(false);
  }

  function handleTabChange(tab: "settings" | "history") {
    setActiveTab(tab);
    if (tab === "history") loadHistory();
  }

  function handleSettingsSave(updated: Partial<FloatRecord>) {
    setRecord((r) => ({ ...r, ...updated, isLow: r.balanceKobo < (updated.lowThresholdKobo ?? r.lowThresholdKobo) }));
  }

  return (
    <Card className="overflow-hidden">
      {/* Main row */}
      <div className="flex items-start gap-4 p-5">
        {/* Icon */}
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: B.orangeLight }}
        >
          <Landmark size={20} style={{ color: B.orange }} strokeWidth={2} />
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold" style={{ color: B.text }}>
              {record.providerName}
            </h3>
            <span
              className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold"
              style={{
                background: B.surface,
                color: B.textMuted,
                border: `1px solid ${B.border}`,
              }}
            >
              {record.providerCode}
            </span>

            {!record.isActive && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{ background: B.surface, color: B.textFaint, border: `1px solid ${B.border}` }}
              >
                Disabled
              </span>
            )}

            {record.isLow && record.isActive && (
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{ background: B.amberLight, color: B.amber }}
              >
                <AlertTriangle size={10} />
                Low float
              </span>
            )}

            {record.autoFundEnabled && (
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{ background: B.greenLight, color: B.green }}
              >
                <TrendingUp size={10} />
                Auto-fund on
              </span>
            )}
          </div>

          {/* Balance bar */}
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px]" style={{ color: B.textFaint }}>
                Balance vs threshold
              </span>
              <span
                className="text-xs font-bold"
                style={{ color: record.isLow ? B.amber : B.text }}
              >
                {fmt(record.balanceKobo)}
                <span
                  className="ml-1 text-[11px] font-normal"
                  style={{ color: B.textFaint }}
                >
                  / {fmt(record.lowThresholdKobo)} threshold
                </span>
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ background: B.surface }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, pct)}%`, background: barColor }}
              />
            </div>
          </div>

          {/* Meta row */}
          <div className="mt-2.5 flex flex-wrap gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: B.textFaint }}>
                Last checked
              </p>
              <p className="text-xs font-medium" style={{ color: B.textMuted }}>
                {timeAgo(record.lastCheckedAt)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: B.textFaint }}>
                Last funded
              </p>
              <p className="text-xs font-medium" style={{ color: B.textMuted }}>
                {timeAgo(record.lastFundedAt)}
              </p>
            </div>
            {record.autoFundEnabled && record.autoFundAmountKobo > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: B.textFaint }}>
                  Auto-fund amount
                </p>
                <p className="text-xs font-medium" style={{ color: B.textMuted }}>
                  {fmt(record.autoFundAmountKobo)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {/* Sync */}
            <button
              onClick={syncBalance}
              disabled={syncing}
              className="flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50"
              style={{ borderColor: B.border, color: B.textMuted }}
              title="Pull live balance from provider"
            >
              <Activity
                size={13}
                className={syncing ? "animate-pulse" : ""}
                style={{ color: syncing ? B.orange : undefined }}
              />
              Sync
            </button>

            {/* Manual fund */}
            <button
              onClick={() => onFundClick(record)}
              className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white transition-all active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
              }}
            >
              <PlusCircle size={13} />
              Fund
            </button>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-[11px] font-semibold transition hover:opacity-70"
            style={{ color: B.orange }}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? "Collapse" : "Configure"}
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div
          className="border-t"
          style={{ borderColor: B.border, background: B.surface }}
        >
          {/* Tabs */}
          <div className="flex border-b" style={{ borderColor: B.border }}>
            {(["settings", "history"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className="flex items-center gap-1.5 px-5 py-3 text-xs font-semibold capitalize transition-colors"
                style={{
                  color: activeTab === tab ? B.orange : B.textMuted,
                  borderBottom:
                    activeTab === tab ? `2px solid ${B.orange}` : "2px solid transparent",
                  background: "transparent",
                }}
              >
                {tab === "settings" ? <Settings2 size={12} /> : <History size={12} />}
                {tab}
              </button>
            ))}
          </div>

          <div className="p-4">
            {activeTab === "settings" && (
              <FloatSettingsPanel
                record={record}
                onSave={handleSettingsSave}
              />
            )}

            {activeTab === "history" && (
              <div>
                {loadingHistory ? (
                  <div
                    className="flex items-center justify-center gap-2 py-8 text-sm"
                    style={{ color: B.textFaint }}
                  >
                    <Loader2 size={16} className="animate-spin" style={{ color: B.orange }} />
                    Loading history…
                  </div>
                ) : history && history.length === 0 ? (
                  <p
                    className="py-8 text-center text-sm"
                    style={{ color: B.textFaint }}
                  >
                    No history yet. Sync or fund this provider to start tracking.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(history ?? []).map((entry) => {
                      const meta = historyTypeLabel(entry.type);
                      const delta =
                        entry.newBalanceKobo !== null
                          ? entry.newBalanceKobo - entry.previousBalanceKobo
                          : null;
                      return (
                        <div
                          key={entry.id}
                          className="flex items-start gap-3 rounded-xl p-3"
                          style={{ background: "#fff", border: `1px solid ${B.border}` }}
                        >
                          <span
                            className="mt-0.5 rounded-lg px-2 py-0.5 text-[10px] font-bold whitespace-nowrap"
                            style={{ background: meta.bg, color: meta.color }}
                          >
                            {meta.label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs" style={{ color: B.text }}>
                              {entry.note}
                            </p>
                            {entry.newBalanceKobo !== null && (
                              <p className="mt-0.5 text-[11px]" style={{ color: B.textFaint }}>
                                {fmt(entry.previousBalanceKobo)} →{" "}
                                <strong>{fmt(entry.newBalanceKobo)}</strong>
                                {delta !== null && delta !== 0 && (
                                  <span
                                    className="ml-1"
                                    style={{ color: delta > 0 ? B.green : B.red }}
                                  >
                                    ({delta > 0 ? "+" : ""}
                                    {fmt(delta)})
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="text-[11px]" style={{ color: B.textFaint }}>
                              {entry.triggeredBy === "admin" ? "Admin" : "System"}
                            </span>
                            <p className="text-[10px]" style={{ color: B.textFaint }}>
                              {tsToDate(entry.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function FloatManagementPage() {
  const [floats, setFloats] = useState<FloatRecord[]>([]);
  const [summary, setSummary] = useState<FloatSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fundTarget, setFundTarget] = useState<FloatRecord | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/providers/floats");
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load");
      setFloats(json.data.floats);
      setSummary(json.data.summary);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleFundDone(providerId: string, newBalance: number) {
    setFloats((prev) =>
      prev.map((f) =>
        f.providerId === providerId
          ? {
              ...f,
              balanceKobo: newBalance,
              isLow: newBalance < f.lowThresholdKobo,
              lastFundedAt: { _seconds: Math.floor(Date.now() / 1000) },
            }
          : f
      )
    );
    setFundTarget(null);
    toast("Top-up recorded successfully.");
    // Update summary
    setSummary((s) =>
      s
        ? {
            ...s,
            totalBalanceKobo:
              s.totalBalanceKobo -
              (floats.find((f) => f.providerId === providerId)?.balanceKobo ?? 0) +
              newBalance,
          }
        : s
    );
  }

  const activeFloats = floats.filter((f) => f.isActive);
  const lowFloats = activeFloats.filter((f) => f.isLow);
  const healthyFloats = activeFloats.filter((f) => !f.isLow);

  if (loading) {
    return (
      <div
        className="flex h-64 items-center justify-center gap-3"
        style={{ color: B.textFaint }}
      >
        <Loader2 size={20} className="animate-spin" style={{ color: B.orange }} />
        <span className="text-sm">Loading float data…</span>
      </div>
    );
  }

  if (error && !floats.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <XCircle size={36} style={{ color: B.red }} />
        <p className="text-sm font-medium" style={{ color: B.text }}>
          {error}
        </p>
        <button
          onClick={() => load()}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
          style={{
            background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
          }}
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: B.text }}>
            Float management
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: B.textMuted }}>
            Monitor provider balances, set alert thresholds, and record top-ups.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-60"
          style={{ borderColor: B.border, color: B.textMuted }}
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{
            background: B.redLight,
            border: `1px solid ${B.red}30`,
            color: B.red,
          }}
        >
          <AlertTriangle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Total float",
              value: fmt(summary.totalBalanceKobo),
              icon: Landmark,
              color: B.orange,
              bg: B.orangeLight,
            },
            {
              label: "Providers low",
              value: String(summary.lowCount),
              icon: AlertTriangle,
              color: summary.lowCount > 0 ? B.amber : B.green,
              bg: summary.lowCount > 0 ? B.amberLight : B.greenLight,
            },
            {
              label: "Auto-fund on",
              value: String(summary.autoFundCount),
              icon: TrendingUp,
              color: B.blue,
              bg: B.blueLight,
            },
            {
              label: "Active providers",
              value: String(summary.activeProviders),
              icon: CheckCircle2,
              color: B.green,
              bg: B.greenLight,
            },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="rounded-2xl bg-white p-4"
                style={{ border: `1px solid ${B.border}` }}
              >
                <div
                  className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ background: s.bg }}
                >
                  <Icon size={16} style={{ color: s.color }} strokeWidth={2} />
                </div>
                <p
                  className="text-xl font-extrabold"
                  style={{ color: B.text }}
                >
                  {s.value}
                </p>
                <p className="text-xs" style={{ color: B.textMuted }}>
                  {s.label}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Low float alert banner */}
      {lowFloats.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-2xl p-4"
          style={{
            background: B.amberLight,
            border: `1px solid ${B.amber}40`,
          }}
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" style={{ color: B.amber }} />
          <div>
            <p className="text-sm font-bold" style={{ color: "#92400E" }}>
              {lowFloats.length} provider{lowFloats.length !== 1 ? "s" : ""} below alert threshold
            </p>
            <p className="mt-0.5 text-xs" style={{ color: "#B45309" }}>
              {lowFloats.map((f) => f.providerName).join(", ")} —
              top up to prevent service interruptions.
            </p>
          </div>
        </div>
      )}

      {/* Provider float cards */}
      {floats.length === 0 ? (
        <div
          className="rounded-2xl py-16 text-center"
          style={{ border: `1px solid ${B.border}` }}
        >
          <Landmark
            size={32}
            className="mx-auto mb-3"
            style={{ color: B.textFaint }}
          />
          <p className="text-sm font-semibold" style={{ color: B.text }}>
            No providers configured
          </p>
          <p className="mt-1 text-xs" style={{ color: B.textFaint }}>
            Add providers in the Provider Config page first.
          </p>
        </div>
      ) : (
        <>
          {/* Low-float providers first */}
          {lowFloats.length > 0 && (
            <div>
              <p
                className="mb-2 text-xs font-bold uppercase tracking-widest"
                style={{ color: B.amber }}
              >
                Needs attention
              </p>
              <div className="space-y-3">
                {lowFloats.map((f) => (
                  <FloatCard
                    key={f.providerId}
                    record={f}
                    onFundClick={setFundTarget}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Healthy providers */}
          {healthyFloats.length > 0 && (
            <div>
              {lowFloats.length > 0 && (
                <p
                  className="mb-2 text-xs font-bold uppercase tracking-widest"
                  style={{ color: B.green }}
                >
                  Healthy
                </p>
              )}
              <div className="space-y-3">
                {healthyFloats.map((f) => (
                  <FloatCard
                    key={f.providerId}
                    record={f}
                    onFundClick={setFundTarget}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Inactive providers */}
          {floats.filter((f) => !f.isActive).length > 0 && (
            <div>
              <p
                className="mb-2 text-xs font-bold uppercase tracking-widest"
                style={{ color: B.textFaint }}
              >
                Disabled providers
              </p>
              <div className="space-y-3">
                {floats
                  .filter((f) => !f.isActive)
                  .map((f) => (
                    <FloatCard
                      key={f.providerId}
                      record={f}
                      onFundClick={setFundTarget}
                    />
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Manual fund modal */}
      {fundTarget && (
        <ManualFundModal
          provider={fundTarget}
          onClose={() => setFundTarget(null)}
          onDone={(newBalance) =>
            handleFundDone(fundTarget.providerId, newBalance)
          }
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-xl"
          style={{ background: "#111827", zIndex: 100 }}
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}