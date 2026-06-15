// vtu-web/app/admin/providers/page.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Wifi,
  Smartphone,
  Tv,
  Zap,
  BookOpen,
  MessageSquare,
  DollarSign,
  Plus,
  Eye,
  EyeOff,
  ShieldAlert,
  Activity,
  ExternalLink,
} from "lucide-react";
import type {
  ProviderRegistryEntry,
  ProviderAuthMethod,
} from "@/types/provider";

// ─── Brand tokens ─────────────────────────────────────────────────────────────

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

type ServiceType =
  | "airtime"
  | "data"
  | "cable"
  | "electricity"
  | "exam"
  | "sms";
type HealthStatus = "healthy" | "degraded" | "down" | null;

interface ProviderRecord {
  id: string;
  code: string;
  name: string;
  baseUrl: string;
  authMethod: ProviderAuthMethod;
  apiKey: string;
  publicKey?: string;
  secretKey?: string;
  username?: string;
  password?: string;
  identifier: string;
  isActive: boolean;
  services: ServiceType[];
  priority: Partial<Record<ServiceType, number>>;
  liveStatus: HealthStatus;
  liveBalanceKobo: number | null;
  cachedBalanceKobo: number | null;
  lowFloatThresholdKobo: number | null;
  lastCheckedAt: unknown;
}

interface RoutingEntry {
  providerId: string;
  providerName: string;
  priority: number;
}
interface PageData {
  providers: ProviderRecord[];
  routingMap: Record<ServiceType, RoutingEntry[]>;
  totalCount: number;
  activeCount: number;
}

// ─── Service metadata ─────────────────────────────────────────────────────────

const SERVICE_META: Record<
  ServiceType,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  airtime: {
    label: "Airtime",
    icon: Smartphone,
    color: B.orange,
    bg: B.orangeLight,
  },
  data: { label: "Data", icon: Wifi, color: B.blue, bg: B.blueLight },
  electricity: {
    label: "Electricity",
    icon: Zap,
    color: B.amber,
    bg: B.amberLight,
  },
  cable: {
    label: "Cable TV",
    icon: Tv,
    color: "#8B5CF6",
    bg: "rgba(139,92,246,0.10)",
  },
  exam: {
    label: "Exam Pins",
    icon: BookOpen,
    color: B.green,
    bg: B.greenLight,
  },
  sms: {
    label: "Bulk SMS",
    icon: MessageSquare,
    color: "#EC4899",
    bg: "rgba(236,72,153,0.10)",
  },
};
const ALL_SERVICES: ServiceType[] = [
  "airtime",
  "data",
  "electricity",
  "cable",
  "exam",
  "sms",
];

// ─── Auth method labels ───────────────────────────────────────────────────────

const AUTH_LABELS: Record<ProviderAuthMethod, string> = {
  api_key: "API Key",
  bearer: "Bearer Token",
  basic: "Basic Auth (username + password)",
  token_login: "Token Login (username + password → token)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function koboToNaira(kobo: number | null | undefined): string {
  if (kobo == null) return "—";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}

function healthMeta(status: HealthStatus) {
  if (status === "healthy")
    return {
      color: B.green,
      bg: B.greenLight,
      label: "Healthy",
      Icon: CheckCircle2,
    };
  if (status === "degraded")
    return {
      color: B.amber,
      bg: B.amberLight,
      label: "Degraded",
      Icon: AlertTriangle,
    };
  if (status === "down")
    return { color: B.red, bg: B.redLight, label: "Down", Icon: XCircle };
  return {
    color: B.textFaint,
    bg: B.surface,
    label: "Unknown",
    Icon: Activity,
  };
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

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

function FormField({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  const isSecret = type === "password";
  return (
    <div>
      <label
        className="mb-1 block text-xs font-semibold"
        style={{ color: B.textMuted }}
      >
        {label} {required && <span style={{ color: B.red }}>*</span>}
      </label>
      <div className="relative flex items-center">
        <input
          type={isSecret && !show ? "password" : "text"}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 pr-8"
          style={{ borderColor: B.border, color: B.text }}
        />
        {isSecret && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2"
            style={{ color: B.textFaint }}
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {hint && (
        <p className="mt-0.5 text-[11px]" style={{ color: B.textFaint }}>
          {hint}
        </p>
      )}
    </div>
  );
}

// ─── Add provider modal ────────────────────────────────────────────────────────

function AddProviderModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [registry, setRegistry] = useState<ProviderRegistryEntry[]>([]);
  const [loadingRegistry, setLoadingRegistry] = useState(true);
  const [selectedCode, setSelectedCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    baseUrl: "",
    identifier: "",
    apiKey: "",
    publicKey: "",
    secretKey: "",
    username: "",
    password: "",
    services: [] as ServiceType[],
  });

  // Load the registry so we can build the dropdown from real implementation codes
  useEffect(() => {
    fetch("/api/internal/providers/registry")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setRegistry(j.data.providers);
      })
      .catch(() => {})
      .finally(() => setLoadingRegistry(false));
  }, []);

  const selectedMeta = registry.find((r) => r.code === selectedCode) ?? null;

  // When code changes, pre-fill name and tick default services
  function handleCodeChange(code: string) {
    setSelectedCode(code);
    const meta = registry.find((r) => r.code === code);
    if (!meta) return;
    setForm((f) => ({
      ...f,
      services: meta.defaultServices as ServiceType[],
      name: f.name || meta.label, // only pre-fill if user hasn't typed yet
    }));
  }

  function toggleService(svc: ServiceType) {
    setForm((f) => ({
      ...f,
      services: f.services.includes(svc)
        ? f.services.filter((s) => s !== svc)
        : [...f.services, svc],
    }));
  }

  function field(key: keyof typeof form) {
    return {
      value: form[key] as string,
      onChange: (v: string) => setForm((f) => ({ ...f, [key]: v })),
    };
  }

  async function submit() {
    if (!selectedCode) {
      setError("Select a provider type first");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          code: selectedCode,
          authMethod: selectedMeta?.authMethod ?? "api_key",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      onAdded();
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Failed to add provider");
    } finally {
      setSaving(false);
    }
  }

  const needsApiKey =
    selectedMeta && ["api_key", "bearer"].includes(selectedMeta.authMethod);
  const needsUserPwd =
    selectedMeta && ["basic", "token_login"].includes(selectedMeta.authMethod);
  const hints = selectedMeta?.credentialHints ?? {};

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl my-8"
        style={{ border: `1px solid ${B.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-base font-bold" style={{ color: B.text }}>
          Add provider
        </h2>
        <p className="mb-4 text-xs" style={{ color: B.textFaint }}>
          Credentials are stored in Firestore and never logged in plaintext.
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

        <div className="space-y-4">
          {/* ── Step 1: pick provider type from real implementation codes ── */}
          <div>
            <label
              className="mb-1 block text-xs font-semibold"
              style={{ color: B.textMuted }}
            >
              Provider type <span style={{ color: B.red }}>*</span>
            </label>
            {loadingRegistry ? (
              <div
                className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: B.border, color: B.textFaint }}
              >
                <Loader2 size={14} className="animate-spin" /> Loading
                providers…
              </div>
            ) : (
              <select
                value={selectedCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{
                  borderColor: B.border,
                  color: selectedCode ? B.text : B.textFaint,
                }}
              >
                <option value="">Select a provider implementation…</option>
                {registry.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label} ({r.code})
                  </option>
                ))}
              </select>
            )}

            {/* Show auth method badge + docs link once selected */}
            {selectedMeta && (
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: B.blueLight, color: B.blue }}
                >
                  {AUTH_LABELS[selectedMeta.authMethod]}
                </span>
                {selectedMeta.docsUrl && (
                  <a
                    href={selectedMeta.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-semibold"
                    style={{ color: B.orange }}
                  >
                    API docs <ExternalLink size={10} />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* ── Basic info ── */}
          <FormField
            label="Display name"
            name="name"
            placeholder="e.g. Adex VTU (Production)"
            required
            {...field("name")}
          />
          <FormField
            label="Base URL"
            name="baseUrl"
            placeholder="https://api.adexvtu.com"
            required
            {...field("baseUrl")}
          />
          <FormField
            label="Webhook identifier"
            name="identifier"
            placeholder="adex"
            required
            hint="Used to route inbound webhooks to this provider"
            {...field("identifier")}
          />

          {/* ── Credentials — shown conditionally based on authMethod ── */}
          {selectedMeta && (
            <div
              className="space-y-3 rounded-xl p-3"
              style={{ background: B.surface, border: `1px solid ${B.border}` }}
            >
              <p className="text-xs font-bold" style={{ color: B.textMuted }}>
                Credentials
              </p>

              {needsUserPwd && (
                <>
                  <FormField
                    label="Username / Email"
                    name="username"
                    required
                    placeholder={hints.username ?? "your@email.com"}
                    {...field("username")}
                  />
                  <FormField
                    label="Password"
                    name="password"
                    type="password"
                    required
                    placeholder={hints.password ?? "••••••••"}
                    {...field("password")}
                  />
                </>
              )}

              {needsApiKey && (
                <>
                  <FormField
                    label="API Key"
                    name="apiKey"
                    type="password"
                    required
                    placeholder={hints.apiKey ?? "sk_live_..."}
                    {...field("apiKey")}
                  />
                  {hints.publicKey !== undefined && (
                    <FormField
                      label="Public Key"
                      name="publicKey"
                      placeholder={hints.publicKey}
                      {...field("publicKey")}
                    />
                  )}
                  {hints.secretKey !== undefined && (
                    <FormField
                      label="Secret Key"
                      name="secretKey"
                      type="password"
                      placeholder={hints.secretKey}
                      {...field("secretKey")}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Services ── */}
          <div>
            <label
              className="mb-1.5 block text-xs font-semibold"
              style={{ color: B.textMuted }}
            >
              Supported services
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SERVICES.map((svc) => {
                const meta = SERVICE_META[svc];
                const Icon = meta.icon;
                const selected = form.services.includes(svc);
                return (
                  <button
                    key={svc}
                    onClick={() => toggleService(svc)}
                    className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all"
                    style={{
                      background: selected ? meta.bg : B.surface,
                      color: selected ? meta.color : B.textMuted,
                      border: `1.5px solid ${selected ? meta.color + "40" : B.border}`,
                    }}
                  >
                    <Icon size={12} strokeWidth={2} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
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
            disabled={
              saving ||
              !selectedCode ||
              !form.name ||
              !form.baseUrl ||
              !form.identifier ||
              form.services.length === 0
            }
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-white transition-all disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
            }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Adding…" : "Add provider"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Provider card ─────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  onToggle,
  onPriorityChange,
  toggling,
}: {
  provider: ProviderRecord;
  onToggle: (id: string, active: boolean) => void;
  onPriorityChange: (
    id: string,
    service: ServiceType,
    priority: number,
  ) => void;
  toggling: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editPriority, setEditPriority] = useState<
    Partial<Record<ServiceType, number>>
  >(provider.priority ?? {});
  const [savingPriority, setSavingPriority] = useState(false);

  const health = healthMeta(provider.liveStatus);
  const HealthIcon = health.Icon;
  const balance = provider.liveBalanceKobo ?? provider.cachedBalanceKobo;
  const isLowFloat =
    balance != null &&
    provider.lowFloatThresholdKobo != null &&
    balance < provider.lowFloatThresholdKobo;

  async function savePriority() {
    setSavingPriority(true);
    try {
      const res = await fetch("/api/internal/providers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: provider.id,
          priority: editPriority,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      for (const [svc, val] of Object.entries(editPriority)) {
        onPriorityChange(provider.id, svc as ServiceType, val as number);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingPriority(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-4 p-5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: B.orangeLight }}
        >
          <Radio size={20} style={{ color: B.orange }} strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold" style={{ color: B.text }}>
              {provider.name}
            </h3>
            <span
              className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold"
              style={{
                background: B.surface,
                color: B.textMuted,
                border: `1px solid ${B.border}`,
              }}
            >
              {provider.code}
            </span>
            {/* Auth method badge */}
            {provider.authMethod && (
              <span
                className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: B.blueLight, color: B.blue }}
              >
                {AUTH_LABELS[provider.authMethod] ?? provider.authMethod}
              </span>
            )}
            {provider.liveStatus && (
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{ background: health.bg, color: health.color }}
              >
                <HealthIcon size={11} />
                {health.label}
              </span>
            )}
            {isLowFloat && (
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{ background: B.amberLight, color: B.amber }}
              >
                <ShieldAlert size={11} />
                Low float
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {ALL_SERVICES.map((svc) => {
              const meta = SERVICE_META[svc];
              const Icon = meta.icon;
              const active = provider.services.includes(svc);
              return (
                <span
                  key={svc}
                  className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    background: active ? meta.bg : B.surface,
                    color: active ? meta.color : B.textFaint,
                    border: `1px solid ${active ? "transparent" : B.border}`,
                    opacity: active ? 1 : 0.5,
                  }}
                >
                  <Icon size={11} strokeWidth={2} />
                  {meta.label}
                </span>
              );
            })}
          </div>

          <div className="mt-2 flex items-center gap-4">
            <div>
              <p className="text-[11px]" style={{ color: B.textFaint }}>
                Float balance
              </p>
              <p
                className="text-sm font-bold"
                style={{ color: isLowFloat ? B.amber : B.text }}
              >
                {koboToNaira(balance)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <Toggle
            checked={provider.isActive}
            onChange={(v) => onToggle(provider.id, v)}
            disabled={toggling}
          />
          <span
            className="text-[11px]"
            style={{ color: provider.isActive ? B.green : B.textFaint }}
          >
            {provider.isActive ? "Enabled" : "Disabled"}
          </span>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-1 flex items-center gap-1 text-[11px] font-semibold transition hover:opacity-70"
            style={{ color: B.orange }}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? "Collapse" : "Configure"}
          </button>
        </div>
      </div>

      {expanded && (
        <div
          className="border-t px-5 pb-5 pt-4 space-y-4"
          style={{ borderColor: B.border, background: B.surface }}
        >
          {/* Routing priority */}
          <div>
            <p
              className="mb-2 text-xs font-semibold"
              style={{ color: B.textMuted }}
            >
              Routing priority per service{" "}
              <span className="font-normal" style={{ color: B.textFaint }}>
                (1 = first, higher = fallback)
              </span>
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {provider.services.map((svc) => {
                const meta = SERVICE_META[svc];
                const Icon = meta.icon;
                return (
                  <div
                    key={svc}
                    className="flex items-center gap-2 rounded-xl px-3 py-2"
                    style={{
                      background: "#fff",
                      border: `1px solid ${B.border}`,
                    }}
                  >
                    <Icon
                      size={14}
                      style={{ color: meta.color }}
                      strokeWidth={2}
                    />
                    <span
                      className="flex-1 text-xs font-medium"
                      style={{ color: B.text }}
                    >
                      {meta.label}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={editPriority[svc] ?? 1}
                      onChange={(e) =>
                        setEditPriority((prev) => ({
                          ...prev,
                          [svc]: Number(e.target.value),
                        }))
                      }
                      className="w-10 rounded-lg border px-1 py-0.5 text-center text-xs font-bold outline-none focus:ring-1"
                      style={{ borderColor: B.border, color: B.text }}
                    />
                  </div>
                );
              })}
            </div>
            <button
              onClick={savePriority}
              disabled={savingPriority}
              className="mt-3 flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-60"
              style={{
                background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
              }}
            >
              {savingPriority && <Loader2 size={12} className="animate-spin" />}
              Save priority
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Routing map panel ────────────────────────────────────────────────────────

function RoutingMapPanel({
  routingMap,
}: {
  routingMap: Record<ServiceType, RoutingEntry[]>;
}) {
  return (
    <Card>
      <div className="border-b px-5 py-4" style={{ borderColor: B.border }}>
        <h2 className="text-sm font-bold" style={{ color: B.text }}>
          Service routing — live order
        </h2>
        <p className="mt-0.5 text-xs" style={{ color: B.textFaint }}>
          Providers are tried in priority order. If the first fails, the next is
          tried automatically.
        </p>
      </div>
      <div
        className="grid grid-cols-1 divide-y sm:grid-cols-2 lg:grid-cols-3"
        style={{ borderColor: B.border }}
      >
        {ALL_SERVICES.map((svc) => {
          const meta = SERVICE_META[svc];
          const Icon = meta.icon;
          const entries = routingMap[svc] ?? [];
          return (
            <div key={svc} className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ background: meta.bg }}
                >
                  <Icon
                    size={14}
                    style={{ color: meta.color }}
                    strokeWidth={2}
                  />
                </div>
                <span className="text-xs font-bold" style={{ color: B.text }}>
                  {meta.label}
                </span>
              </div>
              {entries.length === 0 ? (
                <p className="text-xs italic" style={{ color: B.textFaint }}>
                  No active providers
                </p>
              ) : (
                <ol className="space-y-1.5">
                  {entries.map((entry, i) => (
                    <li
                      key={entry.providerId}
                      className="flex items-center gap-2"
                    >
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{
                          background: i === 0 ? meta.bg : B.surface,
                          color: i === 0 ? meta.color : B.textFaint,
                          border: `1px solid ${i === 0 ? "transparent" : B.border}`,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span
                        className="truncate text-xs font-medium"
                        style={{ color: i === 0 ? B.text : B.textMuted }}
                      >
                        {entry.providerName}
                      </span>
                      {i === 0 && (
                        <span
                          className="ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                          style={{ background: meta.bg, color: meta.color }}
                        >
                          Primary
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProvidersPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  const load = useCallback(
    async (withHealth = false) => {
      if (withHealth) setHealthChecking(true);
      else if (!data) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/internal/providers${withHealth ? "?withHealth=true" : ""}`,
        );
        const json = await res.json();
        if (!json.success)
          throw new Error(json.error ?? "Failed to load providers");
        setData(json.data);
      } catch (e: any) {
        setError(e.message ?? "Could not load providers");
      } finally {
        setLoading(false);
        setRefreshing(false);
        setHealthChecking(false);
      }
    },
    [data],
  );

  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  async function handleToggle(providerId: string, newActive: boolean) {
    setToggling(providerId);
    try {
      const res = await fetch("/api/internal/providers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, isActive: newActive }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setData((prev) =>
        prev
          ? {
              ...prev,
              providers: prev.providers.map((p) =>
                p.id === providerId ? { ...p, isActive: newActive } : p,
              ),
              activeCount: newActive
                ? prev.activeCount + 1
                : prev.activeCount - 1,
            }
          : prev,
      );
      toast(`Provider ${newActive ? "enabled" : "disabled"}`);
    } catch (e: any) {
      toast(`Failed: ${e.message}`);
    } finally {
      setToggling(null);
    }
  }

  function handlePriorityChange(
    providerId: string,
    service: ServiceType,
    priority: number,
  ) {
    setData((prev) => {
      if (!prev) return prev;
      const updated = prev.providers.map((p) =>
        p.id === providerId
          ? { ...p, priority: { ...p.priority, [service]: priority } }
          : p,
      );
      const newRoutingMap = { ...prev.routingMap };
      const entries = updated
        .filter((p) => p.isActive && p.services.includes(service))
        .sort(
          (a, b) => (a.priority[service] ?? 99) - (b.priority[service] ?? 99),
        )
        .map((p) => ({
          providerId: p.id,
          providerName: p.name,
          priority: p.priority[service] ?? 99,
        }));
      newRoutingMap[service] = entries;
      return { ...prev, providers: updated, routingMap: newRoutingMap };
    });
    toast("Priority saved");
  }

  if (loading) {
    return (
      <div
        className="flex h-64 items-center justify-center gap-3"
        style={{ color: B.textFaint }}
      >
        <Loader2
          size={20}
          className="animate-spin"
          style={{ color: B.orange }}
        />
        <span className="text-sm">Loading providers…</span>
      </div>
    );
  }

  if (error && !data) {
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
            Provider config
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: B.textMuted }}>
            Manage VTU provider routing, priorities, and float levels.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data && (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
              style={{ background: B.greenLight, color: B.green }}
            >
              <CheckCircle2 size={13} />
              {data.activeCount} / {data.totalCount} active
            </div>
          )}
          <button
            onClick={() => load(true)}
            disabled={healthChecking || refreshing}
            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-60"
            style={{ borderColor: B.border, color: B.textMuted }}
          >
            <Activity
              size={14}
              className={healthChecking ? "animate-pulse" : ""}
              style={{ color: healthChecking ? B.orange : undefined }}
            />
            {healthChecking ? "Checking…" : "Ping health"}
          </button>
          <button
            onClick={() => load(false)}
            disabled={refreshing || healthChecking}
            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-60"
            style={{ borderColor: B.border, color: B.textMuted }}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition-all active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
            }}
          >
            <Plus size={14} />
            Add provider
          </button>
        </div>
      </div>

      {error && data && (
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

      {data && (
        <>
          {data.providers.length === 0 ? (
            <Card className="py-16 text-center">
              <Radio
                size={32}
                className="mx-auto mb-3"
                style={{ color: B.textFaint }}
              />
              <p className="text-sm font-semibold" style={{ color: B.text }}>
                No providers configured yet
              </p>
              <p className="mt-1 text-xs" style={{ color: B.textFaint }}>
                Add your first VTU provider to start routing transactions.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mx-auto mt-4 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white"
                style={{
                  background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
                }}
              >
                <Plus size={14} />
                Add first provider
              </button>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.providers.map((p) => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  onToggle={handleToggle}
                  onPriorityChange={handlePriorityChange}
                  toggling={toggling === p.id}
                />
              ))}
            </div>
          )}

          {data.providers.length > 0 && (
            <RoutingMapPanel routingMap={data.routingMap} />
          )}
        </>
      )}

      {showAddModal && (
        <AddProviderModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => load()}
        />
      )}

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
