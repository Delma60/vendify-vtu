// vtu-web/app/admin/cashback/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  RefreshCw,
  Pencil,
  BarChart2,
  X,
  AlertCircle,
  Gift,
  Activity,
  TrendingUp,
  Users,
  Target,
  PauseCircle,
  PlayCircle,
  Archive,
  Wallet,
} from "lucide-react";

// ─── Brand tokens (AGENTS.md) ──────────────────────────────────────────────────
// TODO: move to lib/constants.ts once that file exists (see todo.md Phase 0)
// so every admin page imports the same source of truth instead of redefining it.

export const B = {
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
  purple: "#8B5CF6",
  purpleLight: "rgba(139,92,246,0.10)",
  text: "#111827",
  textMuted: "#6B7280",
  textFaint: "#9CA3AF",
  border: "#E5E7EB",
  surface: "#F9FAFB",
};

// ─── Types (mirrors lib/cashback/engine.ts) ───────────────────────────────────

type UserSegment =
  | "all"
  | "kyc_tier_1"
  | "kyc_tier_2"
  | "plan_starter"
  | "plan_pro"
  | "plan_enterprise"
  | "new_users";

type CashbackType = "percentage" | "flat";
type StackingRule = "stackable" | "exclusive";

interface FsTimestamp {
  _seconds: number;
  _nanoseconds?: number;
}

interface CashbackCampaign {
  id: string;
  name: string;
  description: string;
  startDate: FsTimestamp;
  endDate: FsTimestamp;
  targetService: string;
  userSegment: UserSegment;
  cashbackType: CashbackType;
  cashbackValue: number;
  maxCashbackPerUser: number;
  totalBudgetKobo: number;
  stackingRule: StackingRule;
  totalTriggeredCount: number;
  totalPaidKobo: number;
  createdBy: string;
  isActive: boolean;
  isArchived: boolean;
  createdAt: FsTimestamp;
  updatedAt: FsTimestamp;
}

interface CampaignAnalytics {
  campaignId: string;
  campaignName: string;
  totalTriggeredCount: number;
  totalPaidKobo: number;
  totalBudgetKobo: number;
  budgetUtilisationPct: number;
  uniqueUsersRewarded: number;
  avgCashbackKobo: number;
  roiEstimate: string;
  remainingBudgetKobo: number;
  topServices: Array<{ service: string; count: number; totalKobo: number }>;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const SERVICES = [
  "*",
  "airtime",
  "data",
  "electricity",
  "cable",
  "exam_pin",
  "sms",
];

const SEGMENTS: { value: UserSegment; label: string }[] = [
  { value: "all", label: "All users" },
  { value: "new_users", label: "New users (< 30 days)" },
  { value: "kyc_tier_1", label: "KYC Tier 1+" },
  { value: "kyc_tier_2", label: "KYC Tier 2+" },
  { value: "plan_starter", label: "Starter plan" },
  { value: "plan_pro", label: "Pro plan" },
  { value: "plan_enterprise", label: "Enterprise plan" },
];

type CampaignStatus = "scheduled" | "active" | "paused" | "ended" | "archived";

// Static literal classes per status — kept fixed (not interpolated) so Tailwind's
// JIT scanner can see and generate every one of these at build time.
const STATUS_BADGE_CLASS: Record<CampaignStatus, string> = {
  active: "bg-[rgba(34,197,94,0.10)] text-[#22C55E]",
  scheduled: "bg-[rgba(245,158,11,0.10)] text-[#F59E0B]",
  paused: "bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB]",
  ended: "bg-[#F9FAFB] text-[#9CA3AF] border border-[#E5E7EB]",
  archived: "bg-[rgba(239,68,68,0.10)] text-[#EF4444]",
};

const STATUS_LABELS: Record<CampaignStatus, string> = {
  active: "Active",
  scheduled: "Scheduled",
  paused: "Paused",
  ended: "Ended",
  archived: "Archived",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────────

const fmt = (kobo: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    (kobo || 0) / 100,
  );

const toMillis = (ts?: FsTimestamp | string | null): number => {
  if (!ts) return 0;
  if (typeof ts === "string") return new Date(ts).getTime();
  return ts._seconds * 1000;
};

const toDatetimeLocalFromDate = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toDatetimeLocal = (ts?: FsTimestamp | string | null): string => {
  const ms = toMillis(ts);
  return ms ? toDatetimeLocalFromDate(new Date(ms)) : "";
};

const defaultStartLocal = () => toDatetimeLocalFromDate(new Date());
const defaultEndLocal = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return toDatetimeLocalFromDate(d);
};

const fmtDate = (ts?: FsTimestamp | string | null) => {
  const ms = toMillis(ts);
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const serviceLabel = (s: string) =>
  s === "*"
    ? "All services"
    : s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const segmentLabel = (s: UserSegment) =>
  SEGMENTS.find((seg) => seg.value === s)?.label ?? s;

function getCampaignStatus(c: CashbackCampaign): CampaignStatus {
  if (c.isArchived) return "archived";
  if (!c.isActive) return "paused";
  const now = Date.now();
  const start = toMillis(c.startDate);
  const end = toMillis(c.endDate);
  if (now < start) return "scheduled";
  if (now > end) return "ended";
  return "active";
}

// ─── API helper ───────────────────────────────────────────────────────────────────

interface ApiResult<T> {
  ok: boolean;
  data?: T;
  message?: string;
  error?: string;
}

async function apiCall<T = any>(
  url: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        ok: false,
        error: json?.error ?? `Request failed (${res.status})`,
      };
    }
    return { ok: true, data: json.data, message: json.message };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Network error" };
  }
}

// ─── Small stat block ─────────────────────────────────────────────────────────────

function StatBox({
  icon: Icon,
  label,
  value,
  accent = B.orange,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
      <Icon className="h-4 w-4" style={{ color: accent }} />
      <p className="mt-2 text-lg font-bold text-[#111827]">{value}</p>
      <p className="mt-0.5 text-xs text-[#6B7280]">{label}</p>
    </div>
  );
}

// ─── Create / Edit modal ──────────────────────────────────────────────────────────

function CampaignFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: CashbackCampaign | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    startDateLocal: toDatetimeLocal(initial?.startDate) || defaultStartLocal(),
    endDateLocal: toDatetimeLocal(initial?.endDate) || defaultEndLocal(),
    targetService: initial?.targetService ?? "airtime",
    userSegment: (initial?.userSegment ?? "all") as UserSegment,
    cashbackType: (initial?.cashbackType ?? "percentage") as CashbackType,
    cashbackValueDisplay: initial
      ? initial.cashbackType === "percentage"
        ? String(initial.cashbackValue)
        : String(initial.cashbackValue / 100)
      : "1",
    maxCashbackPerUserDisplay: initial
      ? String(initial.maxCashbackPerUser / 100)
      : "0",
    totalBudgetDisplay: initial ? String(initial.totalBudgetKobo / 100) : "0",
    stackingRule: (initial?.stackingRule ?? "stackable") as StackingRule,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setError("");

    if (form.name.trim().length < 2) {
      setError("Campaign name must be at least 2 characters.");
      return;
    }
    if (!form.startDateLocal || !form.endDateLocal) {
      setError("Start and end date/time are required.");
      return;
    }
    const start = new Date(form.startDateLocal);
    const end = new Date(form.endDateLocal);
    if (end <= start) {
      setError("End date must be after start date.");
      return;
    }
    const cashbackValueNum = Number(form.cashbackValueDisplay);
    if (!cashbackValueNum || cashbackValueNum <= 0) {
      setError("Cashback value must be a positive number.");
      return;
    }
    if (form.cashbackType === "percentage" && cashbackValueNum > 100) {
      setError("Percentage cashback cannot exceed 100%.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        targetService: form.targetService,
        userSegment: form.userSegment,
        cashbackType: form.cashbackType,
        cashbackValue:
          form.cashbackType === "percentage"
            ? cashbackValueNum
            : Math.round(cashbackValueNum * 100),
        maxCashbackPerUser: Math.round(
          Number(form.maxCashbackPerUserDisplay || "0") * 100,
        ),
        totalBudgetKobo: Math.round(
          Number(form.totalBudgetDisplay || "0") * 100,
        ),
        stackingRule: form.stackingRule,
      };

      const res = isEdit
        ? await apiCall(`/api/internal/cashback/campaigns/${initial!.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await apiCall("/api/internal/cashback/campaigns", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      if (!res.ok) throw new Error(res.error ?? "Failed to save campaign");
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]/30";
  const labelCls = "mb-1.5 block text-xs font-medium text-[#6B7280]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div className="my-4 w-full max-w-lg rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <h2 className="text-lg font-bold text-[#111827]">
            {isEdit ? "Edit campaign" : "New cashback campaign"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#9CA3AF] hover:bg-[#F9FAFB] hover:text-[#111827]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-[#EF4444]/20 bg-[rgba(239,68,68,0.10)] px-4 py-3 text-sm text-[#EF4444]">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <label className="block">
            <span className={labelCls}>Campaign name</span>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Weekend MTN Data Rush"
            />
          </label>

          <label className="block">
            <span className={labelCls}>Description (internal, optional)</span>
            <textarea
              className={inputCls}
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Shown to admins only"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={labelCls}>Starts</span>
              <input
                type="datetime-local"
                className={inputCls}
                value={form.startDateLocal}
                onChange={(e) => set("startDateLocal", e.target.value)}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Ends</span>
              <input
                type="datetime-local"
                className={inputCls}
                value={form.endDateLocal}
                onChange={(e) => set("endDateLocal", e.target.value)}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={labelCls}>Target service</span>
              <select
                className={inputCls}
                value={form.targetService}
                onChange={(e) => set("targetService", e.target.value)}
              >
                {SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {serviceLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>User segment</span>
              <select
                className={inputCls}
                value={form.userSegment}
                onChange={(e) => set("userSegment", e.target.value)}
              >
                {SEGMENTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={labelCls}>Reward type</span>
              <select
                className={inputCls}
                value={form.cashbackType}
                onChange={(e) => set("cashbackType", e.target.value)}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat (₦)</option>
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>
                {form.cashbackType === "percentage" ? "Rate (%)" : "Amount (₦)"}
              </span>
              <input
                type="number"
                min="0"
                step={form.cashbackType === "percentage" ? "0.1" : "1"}
                className={inputCls}
                value={form.cashbackValueDisplay}
                onChange={(e) => set("cashbackValueDisplay", e.target.value)}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={labelCls}>
                Max cashback per user (₦, 0 = unlimited)
              </span>
              <input
                type="number"
                min="0"
                className={inputCls}
                value={form.maxCashbackPerUserDisplay}
                onChange={(e) =>
                  set("maxCashbackPerUserDisplay", e.target.value)
                }
              />
            </label>
            <label className="block">
              <span className={labelCls}>Total budget (₦, 0 = unlimited)</span>
              <input
                type="number"
                min="0"
                className={inputCls}
                value={form.totalBudgetDisplay}
                onChange={(e) => set("totalBudgetDisplay", e.target.value)}
              />
            </label>
          </div>

          <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-sm font-medium text-[#111827]">
                  Stacking rule
                </span>
                <p className="mt-0.5 text-xs text-[#9CA3AF]">
                  Exclusive campaigns are skipped on transactions where a coupon
                  was applied.
                </p>
              </div>
              <button
                onClick={() =>
                  set(
                    "stackingRule",
                    form.stackingRule === "stackable"
                      ? "exclusive"
                      : "stackable",
                  )
                }
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${form.stackingRule === "exclusive" ? "bg-[#F97316]" : "bg-[#E5E7EB]"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${form.stackingRule === "exclusive" ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
            <p className="mt-2 text-xs font-medium text-[#6B7280]">
              {form.stackingRule === "stackable"
                ? "Stackable — combines with coupons"
                : "Exclusive — coupon transactions are skipped"}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[#F97316] px-5 py-2 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-50"
          >
            {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create campaign"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Analytics modal ──────────────────────────────────────────────────────────────

function AnalyticsModal({
  campaign,
  onClose,
}: {
  campaign: CashbackCampaign;
  onClose: () => void;
}) {
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await apiCall<{
        campaign: CashbackCampaign;
        analytics: CampaignAnalytics;
      }>(`/api/internal/cashback/campaigns/${campaign.id}?analytics=true`);
      if (!active) return;
      if (res.ok && res.data) setAnalytics(res.data.analytics);
      else setError(res.error ?? "Failed to load analytics");
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [campaign.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div className="my-4 w-full max-w-lg rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#111827]">
              {campaign.name}
            </h2>
            <p className="text-xs text-[#9CA3AF]">Campaign analytics</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#9CA3AF] hover:bg-[#F9FAFB] hover:text-[#111827]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-[#F97316]" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#EF4444]/20 bg-[rgba(239,68,68,0.10)] px-4 py-3 text-sm text-[#EF4444]">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          ) : analytics ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <StatBox
                  icon={Activity}
                  label="Total triggered"
                  value={String(analytics.totalTriggeredCount)}
                  accent={B.orange}
                />
                <StatBox
                  icon={Wallet}
                  label="Total paid"
                  value={fmt(analytics.totalPaidKobo)}
                  accent={B.green}
                />
                <StatBox
                  icon={Users}
                  label="Unique users"
                  value={String(analytics.uniqueUsersRewarded)}
                  accent={B.blue}
                />
                <StatBox
                  icon={Gift}
                  label="Avg per reward"
                  value={fmt(analytics.avgCashbackKobo)}
                  accent={B.purple}
                />
              </div>

              {analytics.totalBudgetKobo > 0 && (
                <div>
                  <div className="mb-1.5 flex justify-between text-xs text-[#6B7280]">
                    <span>Budget utilisation</span>
                    <span>{analytics.budgetUtilisationPct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                    <div
                      className="h-full bg-[#F97316]"
                      style={{ width: `${analytics.budgetUtilisationPct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[#9CA3AF]">
                    {fmt(analytics.remainingBudgetKobo)} remaining of{" "}
                    {fmt(analytics.totalBudgetKobo)}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                <p className="text-xs text-[#6B7280]">ROI estimate</p>
                <p className="mt-1 text-sm font-medium text-[#111827]">
                  {analytics.roiEstimate}
                </p>
              </div>

              {analytics.topServices.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-[#6B7280]">
                    Top services
                  </p>
                  <div className="space-y-1.5">
                    {analytics.topServices.map((s) => (
                      <div
                        key={s.service}
                        className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2 text-sm"
                      >
                        <span className="text-[#374151]">
                          {serviceLabel(s.service)}
                        </span>
                        <div className="text-right">
                          <span className="font-medium text-[#111827]">
                            {fmt(s.totalKobo)}
                          </span>
                          <span className="ml-2 text-xs text-[#9CA3AF]">
                            {s.count}x
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── PAGE ──────────────────────────────────────────────────────────────────────────

export default function AdminCashbackPage() {
  const [campaigns, setCampaigns] = useState<CashbackCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CashbackCampaign | null>(null);
  const [analyticsFor, setAnalyticsFor] = useState<CashbackCampaign | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  // NOTE: ListQuerySchema uses z.coerce.boolean(), which coerces ANY non-empty
  // string (including "false") to `true`. We avoid the pitfall by only ever
  // sending the param when it's true, leaving the server-side default(false)
  // to apply otherwise.
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (includeArchived) params.set("includeArchived", "true");
    if (activeOnly) params.set("activeOnly", "true");
    const qs = params.toString();

    const res = await apiCall<{ campaigns: CashbackCampaign[]; count: number }>(
      `/api/internal/cashback/campaigns${qs ? `?${qs}` : ""}`,
    );
    if (res.ok && res.data) setCampaigns(res.data.campaigns);
    else setError(res.error ?? "Failed to load campaigns");
    setLoading(false);
  }, [includeArchived, activeOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (c: CashbackCampaign) => {
    setBusyId(c.id);
    const res = await apiCall(`/api/internal/cashback/campaigns/${c.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    if (!res.ok) alert(res.error ?? "Failed to update campaign");
    setBusyId(null);
    load();
  };

  const archiveCampaign = async (c: CashbackCampaign) => {
    if (
      !confirm(
        `Archive "${c.name}"? It will stop running immediately and can't be re-activated.`,
      )
    )
      return;
    setBusyId(c.id);
    const res = await apiCall(`/api/internal/cashback/campaigns/${c.id}`, {
      method: "DELETE",
    });
    if (!res.ok) alert(res.error ?? "Failed to archive campaign");
    setBusyId(null);
    load();
  };

  const stats = useMemo(() => {
    const active = campaigns.filter(
      (c) => getCampaignStatus(c) === "active",
    ).length;
    const totalPaid = campaigns.reduce((s, c) => s + c.totalPaidKobo, 0);
    const totalTriggered = campaigns.reduce(
      (s, c) => s + c.totalTriggeredCount,
      0,
    );
    return { active, totalPaid, totalTriggered };
  }, [campaigns]);

  return (
    <div className="min-h-screen bg-white px-6 py-8 text-[#111827]">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">
              Cashback Campaigns
            </h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              Reward customers automatically when they top up, buy data, and
              more.
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#EA580C]"
          >
            <Plus className="h-4 w-4" /> Create campaign
          </button>
        </div>

        {/* Summary */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="col-span-2 rounded-2xl border border-[#F97316]/20 bg-gradient-to-br from-[rgba(249,115,22,0.10)] to-[rgba(34,197,94,0.10)] p-6 sm:col-span-2">
            <Gift className="h-6 w-6" style={{ color: B.orange }} />
            <p className="mt-4 text-3xl font-extrabold tracking-tight text-[#111827]">
              {fmt(stats.totalPaid)}
            </p>
            <p className="mt-1 text-sm text-[#6B7280]">
              Total cashback paid out
            </p>
          </div>
          <StatBox
            icon={Activity}
            label="Active now"
            value={String(stats.active)}
            accent={B.green}
          />
          <StatBox
            icon={TrendingUp}
            label="Rewards triggered"
            value={String(stats.totalTriggered)}
            accent={B.amber}
          />
        </div>

        {/* Campaign list */}
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-4">
            <h2 className="text-sm font-semibold text-[#111827]">
              All campaigns
            </h2>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-[#6B7280] cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  className="rounded accent-[#F97316]"
                />
                Enabled only
              </label>
              <label className="flex items-center gap-2 text-xs text-[#6B7280] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="rounded accent-[#F97316]"
                />
                Show archived
              </label>
              <button
                onClick={load}
                className="rounded-lg p-1.5 text-[#6B7280] hover:bg-white hover:text-[#111827]"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 border-b border-[#EF4444]/20 bg-[rgba(239,68,68,0.10)] px-5 py-3 text-sm text-[#EF4444]">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <RefreshCw className="h-7 w-7 animate-spin text-[#F97316]" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="py-16 text-center">
              <Gift className="mx-auto h-10 w-10 text-[#E5E7EB]" />
              <p className="mt-3 text-sm text-[#6B7280]">No campaigns yet.</p>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                Create one to start rewarding customers automatically.
              </p>
              <button
                onClick={() => {
                  setEditing(null);
                  setShowForm(true);
                }}
                className="mt-4 rounded-xl bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C]"
              >
                Create first campaign
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#E5E7EB]">
              {campaigns.map((c) => {
                const status = getCampaignStatus(c);
                return (
                  <div
                    key={c.id}
                    className="flex flex-col gap-3 px-5 py-4 transition hover:bg-[#F9FAFB] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#111827]">{c.name}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}
                        >
                          {STATUS_LABELS[status]}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] px-2 py-0.5 text-xs text-[#6B7280]">
                          <Target className="h-3 w-3" />{" "}
                          {serviceLabel(c.targetService)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] px-2 py-0.5 text-xs text-[#6B7280]">
                          <Users className="h-3 w-3" />{" "}
                          {segmentLabel(c.userSegment)}
                        </span>
                      </div>
                      {c.description && (
                        <p className="mt-1 text-xs text-[#9CA3AF]">
                          {c.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#6B7280]">
                        <span>
                          Reward:{" "}
                          <span className="font-medium text-[#111827]">
                            {c.cashbackType === "percentage"
                              ? `${c.cashbackValue}%`
                              : fmt(c.cashbackValue)}
                          </span>
                        </span>
                        <span>
                          {fmtDate(c.startDate)} → {fmtDate(c.endDate)}
                        </span>
                        <span>{c.totalTriggeredCount} triggered</span>
                        <span
                          className="font-medium"
                          style={{ color: B.green }}
                        >
                          {fmt(c.totalPaidKobo)} paid
                        </span>
                        {c.totalBudgetKobo > 0 && (
                          <span>Budget cap: {fmt(c.totalBudgetKobo)}</span>
                        )}
                        <span className="capitalize text-[#9CA3AF]">
                          {c.stackingRule}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        onClick={() => setAnalyticsFor(c)}
                        className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-white"
                      >
                        <BarChart2 className="h-3.5 w-3.5" /> Analytics
                      </button>
                      {!c.isArchived && (
                        <>
                          <button
                            onClick={() => {
                              setEditing(c);
                              setShowForm(true);
                            }}
                            className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-white"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => toggleActive(c)}
                            disabled={busyId === c.id}
                            className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-white disabled:opacity-50"
                          >
                            {busyId === c.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : c.isActive ? (
                              <PauseCircle className="h-3.5 w-3.5" />
                            ) : (
                              <PlayCircle className="h-3.5 w-3.5" />
                            )}
                            {c.isActive ? "Pause" : "Resume"}
                          </button>
                          <button
                            onClick={() => archiveCampaign(c)}
                            disabled={busyId === c.id}
                            className="flex items-center gap-1.5 rounded-lg border border-[#EF4444]/20 px-3 py-1.5 text-xs font-medium text-[#EF4444] hover:bg-[rgba(239,68,68,0.10)] disabled:opacity-50"
                          >
                            <Archive className="h-3.5 w-3.5" /> Archive
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <CampaignFormModal
          initial={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditing(null);
            load();
          }}
        />
      )}

      {analyticsFor && (
        <AnalyticsModal
          campaign={analyticsFor}
          onClose={() => setAnalyticsFor(null)}
        />
      )}
    </div>
  );
}
