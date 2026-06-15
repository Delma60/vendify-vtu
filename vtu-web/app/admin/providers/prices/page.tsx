// vtu-web/app/admin/providers/prices/page.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
  Filter,
  RotateCcw,
  Download,
  Clock,
  Wifi,
  Smartphone,
  Tv,
  Zap,
  BookOpen,
  MessageSquare,
  Edit2,
  Check,
  X,
  History,
  Info,
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

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceType = "airtime" | "data" | "cable" | "electricity" | "exam" | "sms";

interface ServicePriceConfig {
  id: string;
  service: string;
  network: string | null;
  label: string;
  costPriceKobo: number;
  sellPriceKobo: number;
  marginPercent: number;
  marginBreached: boolean;
  providerCode: string | null;
  lastSyncedAt: { _seconds: number } | null;
  supportsPriceSync: boolean;
  isActive: boolean;
  updatedBy: string;
}

interface Summary {
  total: number;
  breached: number;
  noCostData: number;
  syncEnabled: number;
}

interface PriceSyncResult {
  service: string;
  network: string | null;
  providerCode: string;
  previousCostKobo: number;
  newCostKobo: number;
  sellPriceKobo: number;
  marginBreached: boolean;
  error: string | null;
}

interface SyncSummary {
  synced: number;
  skipped: number;
  breached: number;
  errors: number;
  results: PriceSyncResult[];
  ranAt: string;
}

interface PriceLogEntry {
  id: string;
  label: string;
  service: string;
  previousSellKobo: number;
  newSellKobo: number;
  changedBy: string;
  source: "manual" | "sync";
  createdAt: { _seconds: number };
}

// ─── Service metadata ──────────────────────────────────────────────────────────

const SERVICE_META: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  airtime: { label: "Airtime", icon: Smartphone, color: B.orange, bg: B.orangeLight },
  data: { label: "Data", icon: Wifi, color: B.blue, bg: B.blueLight },
  electricity: { label: "Electricity", icon: Zap, color: B.amber, bg: B.amberLight },
  cable: { label: "Cable TV", icon: Tv, color: "#8B5CF6", bg: "rgba(139,92,246,0.10)" },
  exam: { label: "Exam Pins", icon: BookOpen, color: B.green, bg: B.greenLight },
  sms: { label: "Bulk SMS", icon: MessageSquare, color: "#EC4899", bg: "rgba(236,72,153,0.10)" },
};

const ALL_SERVICES = ["airtime", "data", "electricity", "cable", "exam", "sms"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function koboToNaira(kobo: number): string {
  if (kobo === 0) return "—";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(kobo / 100);
}

function nairaInputToKobo(val: string): number {
  const n = parseFloat(val.replace(/,/g, ""));
  if (isNaN(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function koboToNairaInput(kobo: number): string {
  if (kobo === 0) return "";
  return (kobo / 100).toFixed(2);
}

function timeSince(seconds: number): string {
  const diff = Math.floor(Date.now() / 1000 - seconds);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function marginColor(pct: number, breached: boolean) {
  if (breached) return B.red;
  if (pct < 5) return B.amber;
  if (pct >= 15) return B.green;
  return B.blue;
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white ${className}`} style={{ border: `1px solid ${B.border}` }}>
      {children}
    </div>
  );
}

function StatPill({
  label, value, color, bg,
}: { label: string; value: string | number; color: string; bg: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl px-5 py-4" style={{ background: bg }}>
      <span className="text-2xl font-extrabold" style={{ color }}>{value}</span>
      <span className="mt-0.5 text-xs font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

// ─── Inline price editor ───────────────────────────────────────────────────────

function PriceEditor({
  config,
  onSaved,
}: {
  config: ServicePriceConfig;
  onSaved: (id: string, newKobo: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(koboToNairaInput(config.sellPriceKobo));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setValue(koboToNairaInput(config.sellPriceKobo));
    setEditing(true);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  async function save() {
    const kobo = nairaInputToKobo(value);
    if (kobo === config.sellPriceKobo) { setEditing(false); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/providers/prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: config.id, sellPriceKobo: kobo }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      onSaved(config.id, kobo);
      setEditing(false);
    } catch (e: any) {
      setError(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold" style={{ color: B.text }}>
          {config.sellPriceKobo ? koboToNaira(config.sellPriceKobo) : <span style={{ color: B.textFaint }}>—</span>}
        </span>
        <button
          onClick={startEdit}
          className="rounded-lg p-1 transition hover:bg-gray-100"
          style={{ color: B.textFaint }}
          title="Edit selling price"
        >
          <Edit2 size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-xs" style={{ color: B.textFaint }}>₦</span>
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          className="w-24 rounded-lg border px-2 py-1 text-sm font-bold outline-none focus:ring-2"
          style={{ borderColor: B.orange, color: B.text }}
          disabled={saving}
        />
        <button
          onClick={save}
          disabled={saving}
          className="flex h-6 w-6 items-center justify-center rounded-lg transition hover:opacity-80 disabled:opacity-50"
          style={{ background: B.green, color: "#fff" }}
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
        </button>
        <button
          onClick={cancel}
          disabled={saving}
          className="flex h-6 w-6 items-center justify-center rounded-lg transition hover:opacity-80"
          style={{ background: B.redLight, color: B.red }}
        >
          <X size={11} />
        </button>
      </div>
      {error && <p className="text-[11px]" style={{ color: B.red }}>{error}</p>}
    </div>
  );
}

// ─── Price row ────────────────────────────────────────────────────────────────

function PriceRow({
  config,
  onSaved,
}: {
  config: ServicePriceConfig;
  onSaved: (id: string, newKobo: number) => void;
}) {
  const svc = SERVICE_META[config.service] ?? SERVICE_META.data;
  const Icon = svc.icon;
  const mColor = marginColor(config.marginPercent, config.marginBreached);

  return (
    <tr className="group transition-colors hover:bg-gray-50">
      {/* Service */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: svc.bg }}
          >
            <Icon size={14} style={{ color: svc.color }} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" style={{ color: B.text }}>
              {config.label}
            </p>
            {config.network && (
              <p className="text-[11px] uppercase" style={{ color: B.textFaint }}>
                {config.network}
              </p>
            )}
          </div>
          {config.marginBreached && (
            <AlertTriangle size={13} style={{ color: B.red }} className="shrink-0" />
          )}
        </div>
      </td>

      {/* Cost price */}
      <td className="px-4 py-3 text-sm" style={{ color: B.textMuted }}>
        {config.costPriceKobo ? koboToNaira(config.costPriceKobo) : (
          <span className="text-xs italic" style={{ color: B.textFaint }}>No data</span>
        )}
      </td>

      {/* Selling price — editable */}
      <td className="px-4 py-3">
        <PriceEditor config={config} onSaved={onSaved} />
      </td>

      {/* Margin */}
      <td className="px-4 py-3">
        {config.costPriceKobo > 0 ? (
          <div className="flex items-center gap-1.5">
            <span
              className="rounded-lg px-2 py-0.5 text-xs font-bold"
              style={{ background: `${mColor}18`, color: mColor }}
            >
              {config.marginBreached ? "−" : ""}{Math.abs(config.marginPercent).toFixed(1)}%
            </span>
            {config.marginBreached ? (
              <TrendingDown size={12} style={{ color: B.red }} />
            ) : (
              <TrendingUp size={12} style={{ color: mColor }} />
            )}
          </div>
        ) : (
          <span className="text-xs italic" style={{ color: B.textFaint }}>—</span>
        )}
      </td>

      {/* Last synced */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {config.lastSyncedAt ? (
            <>
              <Clock size={11} style={{ color: B.textFaint }} />
              <span className="text-xs" style={{ color: B.textFaint }}>
                {timeSince(config.lastSyncedAt._seconds)}
              </span>
            </>
          ) : (
            <span className="text-xs italic" style={{ color: B.textFaint }}>Never</span>
          )}
          {config.supportsPriceSync && (
            <span
              className="ml-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: B.greenLight, color: B.green }}
            >
              Auto
            </span>
          )}
        </div>
      </td>

      {/* Provider */}
      <td className="px-4 py-3">
        {config.providerCode ? (
          <span
            className="rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold"
            style={{ background: B.surface, color: B.textMuted, border: `1px solid ${B.border}` }}
          >
            {config.providerCode}
          </span>
        ) : (
          <span className="text-xs italic" style={{ color: B.textFaint }}>—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Sync result drawer ───────────────────────────────────────────────────────

function SyncResultPanel({
  summary,
  onClose,
}: {
  summary: SyncSummary;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        style={{ border: `1px solid ${B.border}` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold" style={{ color: B.text }}>Price sync complete</h2>
            <p className="text-xs" style={{ color: B.textFaint }}>
              {new Date(summary.ranAt).toLocaleString("en-NG")}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100" style={{ color: B.textMuted }}>
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-4 gap-2">
          {[
            { label: "Synced", value: summary.synced, color: B.green, bg: B.greenLight },
            { label: "Skipped", value: summary.skipped, color: B.textMuted, bg: B.surface },
            { label: "Breached", value: summary.breached, color: B.red, bg: B.redLight },
            { label: "Errors", value: summary.errors, color: B.amber, bg: B.amberLight },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: s.bg }}>
              <p className="text-lg font-extrabold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[11px] font-semibold" style={{ color: s.color }}>{s.label}</p>
            </div>
          ))}
        </div>

        {summary.results.length > 0 && (
          <div className="space-y-2">
            {summary.results.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{
                  background: r.error ? B.redLight : r.marginBreached ? B.amberLight : B.greenLight,
                  border: `1px solid ${r.error ? B.red : r.marginBreached ? B.amber : B.green}20`,
                }}
              >
                {r.error ? (
                  <X size={13} style={{ color: B.red }} className="shrink-0" />
                ) : r.marginBreached ? (
                  <AlertTriangle size={13} style={{ color: B.amber }} className="shrink-0" />
                ) : (
                  <CheckCircle2 size={13} style={{ color: B.green }} className="shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold" style={{ color: B.text }}>
                    {r.service}{r.network ? ` — ${r.network}` : ""}
                  </p>
                  {r.error ? (
                    <p className="text-[11px]" style={{ color: B.red }}>{r.error}</p>
                  ) : (
                    <p className="text-[11px]" style={{ color: B.textFaint }}>
                      Cost: {koboToNaira(r.newCostKobo)} · Sell: {koboToNaira(r.sellPriceKobo)}
                      {r.marginBreached && " · ⚠️ Margin breach"}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-2xl py-2.5 text-sm font-bold text-white transition active:scale-[0.98]"
          style={{ background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})` }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Price change log tab ─────────────────────────────────────────────────────

function PriceLogTab() {
  const [entries, setEntries] = useState<PriceLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/internal/providers/prices?view=log&page=${pg}&pageSize=30`);
      const json = await res.json();
      if (json.success) {
        setEntries(pg === 1 ? json.data.entries : prev => [...prev, ...json.data.entries]);
        setHasMore(json.data.pagination.hasMore);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  if (loading && entries.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center gap-3" style={{ color: B.textFaint }}>
        <Loader2 size={18} className="animate-spin" style={{ color: B.orange }} />
        <span className="text-sm">Loading history…</span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="py-16 text-center">
        <History size={28} className="mx-auto mb-3" style={{ color: B.textFaint }} />
        <p className="text-sm" style={{ color: B.textMuted }}>No price changes recorded yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y" style={{ borderColor: B.border }}>
        {entries.map(e => (
          <div key={e.id} className="flex items-center gap-4 px-5 py-3 transition hover:bg-gray-50">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
              style={{ background: e.source === "sync" ? B.blueLight : B.orangeLight }}
            >
              {e.source === "sync"
                ? <RotateCcw size={13} style={{ color: B.blue }} />
                : <Edit2 size={13} style={{ color: B.orange }} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold" style={{ color: B.text }}>{e.label}</p>
              <p className="text-xs" style={{ color: B.textFaint }}>
                {e.source === "sync" ? "Auto sync" : `Admin: ${e.changedBy}`}
                {" · "}
                {timeSince(e.createdAt._seconds)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold" style={{ color: B.text }}>{koboToNaira(e.newSellKobo)}</p>
              {e.previousSellKobo > 0 && (
                <p className="text-xs line-through" style={{ color: B.textFaint }}>
                  {koboToNaira(e.previousSellKobo)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      {hasMore && (
        <div className="p-4 text-center">
          <button
            onClick={() => { const next = page + 1; setPage(next); load(next); }}
            disabled={loading}
            className="rounded-xl px-4 py-2 text-sm font-semibold transition"
            style={{ border: `1px solid ${B.border}`, color: B.textMuted }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PricesPage() {
  const [configs, setConfigs] = useState<ServicePriceConfig[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showBreachedOnly, setShowBreachedOnly] = useState(false);
  const [tab, setTab] = useState<"prices" | "log">("prices");

  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);
  const [syncService, setSyncService] = useState<string>("all");

  function showToast(msg: string, type: "success" | "error" | "warn" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/providers/prices");
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load");
      setConfigs(json.data.configs);
      setSummary(json.data.summary);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/internal/providers/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: syncService === "all" ? undefined : syncService }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Sync failed");
      setSyncSummary(json.data.summary);
      await load(true);
      showToast(
        json.data.summary.breached > 0
          ? `Sync done — ${json.data.summary.breached} margin breach(es) detected!`
          : `Sync complete: ${json.data.summary.synced} updated.`,
        json.data.summary.breached > 0 ? "warn" : "success"
      );
    } catch (e: any) {
      showToast(e.message ?? "Sync failed", "error");
    } finally {
      setSyncing(false);
    }
  }

  function handlePriceSaved(id: string, newKobo: number) {
    setConfigs(prev =>
      prev.map(c => {
        if (c.id !== id) return c;
        const cost = c.costPriceKobo;
        const mPct = newKobo > 0 && cost > 0
          ? Math.round(((newKobo - cost) / newKobo) * 100 * 10) / 10
          : 0;
        return { ...c, sellPriceKobo: newKobo, marginPercent: mPct, marginBreached: cost > 0 && cost > newKobo };
      })
    );
    setSummary(prev =>
      prev ? { ...prev, breached: configs.filter(c => c.id === id ? cost > newKobo : c.marginBreached).length } : prev
    );
    showToast("Selling price updated.", "success");
  }

  const cost = 0; // satisfy closure for handlePriceSaved

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = configs.filter(c => {
    if (serviceFilter !== "all" && c.service !== serviceFilter) return false;
    if (showBreachedOnly && !c.marginBreached) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.label.toLowerCase().includes(q) && !(c.network ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ── Group by service ───────────────────────────────────────────────────────
  const grouped = filtered.reduce<Record<string, ServicePriceConfig[]>>((acc, c) => {
    (acc[c.service] = acc[c.service] ?? []).push(c);
    return acc;
  }, {});

  const toastColor = toast?.type === "error" ? B.red : toast?.type === "warn" ? B.amber : B.green;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3" style={{ color: B.textFaint }}>
        <Loader2 size={20} className="animate-spin" style={{ color: B.orange }} />
        <span className="text-sm">Loading price config…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: B.text }}>Price management</h1>
          <p className="mt-0.5 text-sm" style={{ color: B.textMuted }}>
            Manage selling prices and sync cost prices from provider APIs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={syncService}
            onChange={e => setSyncService(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: B.border, color: B.text }}
          >
            <option value="all">All services</option>
            {ALL_SERVICES.map(s => (
              <option key={s} value={s}>{SERVICE_META[s]?.label ?? s}</option>
            ))}
          </select>
          <button
            onClick={handleSync}
            disabled={syncing || refreshing}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})` }}
          >
            {syncing
              ? <><Loader2 size={14} className="animate-spin" /> Syncing…</>
              : <><RotateCcw size={14} /> Sync prices</>}
          </button>
          <button
            onClick={() => load(true)}
            disabled={refreshing || syncing}
            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-60"
            style={{ borderColor: B.border, color: B.textMuted }}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ── Alert banner for breaches ── */}
      {summary && summary.breached > 0 && (
        <div
          className="flex items-start gap-3 rounded-2xl px-4 py-3"
          style={{ background: B.redLight, border: `1px solid ${B.red}25` }}
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: B.red }} />
          <div>
            <p className="text-sm font-bold" style={{ color: "#7F1D1D" }}>
              {summary.breached} margin breach{summary.breached !== 1 ? "es" : ""}
            </p>
            <p className="text-xs" style={{ color: "#B91C1C" }}>
              Cost price exceeds selling price. Update prices immediately to avoid losses.
            </p>
          </div>
          <button
            onClick={() => setShowBreachedOnly(b => !b)}
            className="ml-auto shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition"
            style={{
              background: showBreachedOnly ? B.red : "rgba(239,68,68,0.15)",
              color: showBreachedOnly ? "#fff" : B.red,
            }}
          >
            {showBreachedOnly ? "Show all" : "Show breached only"}
          </button>
        </div>
      )}

      {/* ── Stat pills ── */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatPill label="Total configs" value={summary.total} color={B.blue} bg={B.blueLight} />
          <StatPill label="Auto-sync" value={summary.syncEnabled} color={B.green} bg={B.greenLight} />
          <StatPill label="No cost data" value={summary.noCostData} color={B.amber} bg={B.amberLight} />
          <StatPill label="Margin breached" value={summary.breached} color={B.red} bg={B.redLight} />
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 rounded-2xl p-1" style={{ background: B.surface, border: `1px solid ${B.border}` }}>
        {[
          { key: "prices", label: "Prices" },
          { key: "log", label: "Change log" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className="flex-1 rounded-xl py-2 text-sm font-semibold transition"
            style={{
              background: tab === t.key ? "#fff" : "transparent",
              color: tab === t.key ? B.text : B.textMuted,
              boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "log" ? (
        <Card><PriceLogTab /></Card>
      ) : (
        <>
          {/* ── Filters ── */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex flex-1 items-center gap-2 rounded-xl border px-3 py-2"
              style={{ borderColor: B.border, minWidth: 180 }}
            >
              <Search size={14} style={{ color: B.textFaint }} />
              <input
                type="text"
                placeholder="Search services…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: B.text }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ color: B.textFaint }}>
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setServiceFilter("all")}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold transition"
                style={{
                  background: serviceFilter === "all" ? B.orangeLight : B.surface,
                  color: serviceFilter === "all" ? B.orange : B.textMuted,
                  border: `1px solid ${serviceFilter === "all" ? B.orange + "40" : B.border}`,
                }}
              >
                All
              </button>
              {ALL_SERVICES.map(s => {
                const meta = SERVICE_META[s];
                const Icon = meta.icon;
                const active = serviceFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setServiceFilter(active ? "all" : s)}
                    className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition"
                    style={{
                      background: active ? meta.bg : B.surface,
                      color: active ? meta.color : B.textMuted,
                      border: `1px solid ${active ? meta.color + "40" : B.border}`,
                    }}
                  >
                    <Icon size={11} strokeWidth={2} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {error ? (
            <Card className="py-16 text-center">
              <p className="text-sm" style={{ color: B.red }}>{error}</p>
              <button onClick={() => load()} className="mt-3 text-sm underline" style={{ color: B.orange }}>
                Retry
              </button>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="py-16 text-center">
              <Info size={24} className="mx-auto mb-3" style={{ color: B.textFaint }} />
              <p className="text-sm" style={{ color: B.textMuted }}>No price configs match your filters.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([service, rows]) => {
                const meta = SERVICE_META[service] ?? SERVICE_META.data;
                const Icon = meta.icon;
                const breachedCount = rows.filter(r => r.marginBreached).length;

                return (
                  <Card key={service} className="overflow-hidden">
                    {/* Service header */}
                    <div
                      className="flex items-center gap-3 border-b px-4 py-3"
                      style={{ borderColor: B.border, background: meta.bg + "50" }}
                    >
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-xl"
                        style={{ background: meta.bg }}
                      >
                        <Icon size={16} style={{ color: meta.color }} strokeWidth={2} />
                      </div>
                      <h2 className="text-sm font-bold" style={{ color: B.text }}>
                        {meta.label}
                      </h2>
                      <span className="text-xs" style={{ color: B.textFaint }}>
                        {rows.length} config{rows.length !== 1 ? "s" : ""}
                      </span>
                      {breachedCount > 0 && (
                        <span
                          className="ml-auto flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold"
                          style={{ background: B.redLight, color: B.red }}
                        >
                          <AlertTriangle size={10} />
                          {breachedCount} breach{breachedCount !== 1 ? "es" : ""}
                        </span>
                      )}
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px]">
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                            {["Service / Plan", "Cost price", "Selling price", "Margin", "Last synced", "Provider"].map(h => (
                              <th
                                key={h}
                                className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide"
                                style={{ color: B.textFaint }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: B.border }}>
                          {rows.map(c => (
                            <PriceRow key={c.id} config={c} onSaved={handlePriceSaved} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Sync result modal ── */}
      {syncSummary && (
        <SyncResultPanel summary={syncSummary} onClose={() => setSyncSummary(null)} />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-2xl"
          style={{ background: toastColor }}
        >
          {toast.type === "error" ? <X size={14} /> : toast.type === "warn" ? <AlertTriangle size={14} /> : <Check size={14} />}
          {toast.msg}
        </div>
      )}

      {/* ── Info box ── */}
      <div
        className="flex items-start gap-3 rounded-2xl px-4 py-3 text-sm"
        style={{ background: B.blueLight, border: `1px solid ${B.blue}20` }}
      >
        <Info size={15} className="mt-0.5 shrink-0" style={{ color: B.blue }} />
        <p style={{ color: "#1E40AF" }}>
          <strong>Auto-sync</strong> pulls cost prices from providers that expose a price API every 6 hours.
          Services marked <span className="font-bold">Manual</span> require you to update cost prices here.
          Selling prices are always set manually. A{" "}
          <strong>margin breach</strong> means cost &gt; sell — you are losing money per transaction.
        </p>
      </div>
    </div>
  );
}