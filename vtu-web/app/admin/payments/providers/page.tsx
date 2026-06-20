"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  CreditCard,
  Loader2,
  ChevronDown,
  RefreshCw,
} from "lucide-react";

interface PaymentProvider {
  id: string;
  name: string;
  isActive: boolean;
  publicKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  feePercentage?: number;
  feeCap?: number;
}

type SecretField = "publicKey" | "secretKey" | "webhookSecret";

const SECRET_FIELDS: { key: SecretField; label: string; placeholder: string }[] = [
  { key: "publicKey", label: "Public key", placeholder: "Not set" },
  { key: "secretKey", label: "Secret key", placeholder: "Not set" },
  { key: "webhookSecret", label: "Webhook secret", placeholder: "Not set" },
];

// ── Connection status ─────────────────────────────────────────────────────
// "incomplete" / "inactive" are derived locally (no point pinging for these).
// "checking" / "connected" / "unreachable" / "unsupported" all come back
// from a real outbound call made by POST /api/internal/payment-providers/:id/ping.

type PingState =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "success"; latencyMs?: number }
  | { state: "error"; reason?: string; message?: string }
  | { state: "unsupported" };

type ConnectionStatus = "connected" | "unreachable" | "checking" | "unsupported" | "incomplete" | "inactive";

function getConnectionStatus(p: PaymentProvider, ping: PingState | undefined): ConnectionStatus {
  if (!p.isActive) return "inactive";
  if (!p.publicKey || !p.secretKey || !p.webhookSecret) return "incomplete";
  if (!ping || ping.state === "idle") return "checking";
  if (ping.state === "checking") return "checking";
  if (ping.state === "success") return "connected";
  if (ping.state === "unsupported") return "unsupported";
  return "unreachable";
}

const STATUS_META: Record<
  ConnectionStatus,
  { label: string; dot: string; text: string; ring: boolean; spin?: boolean }
> = {
  connected: { label: "Connected", dot: "bg-[#22C55E]", text: "text-[#15803D]", ring: true },
  unreachable: { label: "Unreachable", dot: "bg-red-500", text: "text-red-600", ring: false },
  checking: { label: "Checking…", dot: "bg-gray-300", text: "text-gray-400", ring: false, spin: true },
  unsupported: { label: "Can't verify", dot: "bg-gray-300", text: "text-gray-400", ring: false },
  incomplete: { label: "Needs setup", dot: "bg-amber-400", text: "text-amber-600", ring: false },
  inactive: { label: "Inactive", dot: "bg-gray-300", text: "text-gray-400", ring: false },
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function ConnectionDot({ status, size = "sm" }: { status: ConnectionStatus; size?: "sm" | "corner" }) {
  const meta = STATUS_META[status];
  const dotEl = meta.spin ? (
    <RefreshCw className="w-2.5 h-2.5 text-gray-400 animate-spin" />
  ) : (
    <span className="relative flex h-2.5 w-2.5">
      {meta.ring && (
        <span className={`absolute inline-flex h-full w-full rounded-full ${meta.dot} opacity-60 animate-ping`} />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${meta.dot}`} />
    </span>
  );

  if (size === "corner") {
    return (
      <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white">
        {dotEl}
      </span>
    );
  }
  return dotEl;
}

export default function AdminPaymentProvidersPage() {
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pingState, setPingState] = useState<Record<string, PingState>>({});

  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // ── Real handshake ────────────────────────────────────────────────────────
  const testConnection = useCallback(async (provider: PaymentProvider) => {
    setPingState((prev) => ({ ...prev, [provider.id]: { state: "checking" } }));
    try {
      const res = await fetch(`/api/internal/payment-providers/${provider.id}/ping`, { method: "POST" });
      const json = await res.json();

      if (!json.success) {
        setPingState((prev) => ({ ...prev, [provider.id]: { state: "error", message: json.error } }));
        return;
      }

      const { healthy, reason, message, latencyMs } = json.data as {
        healthy: boolean;
        reason?: string;
        message?: string;
        latencyMs?: number;
      };

      if (healthy) {
        setPingState((prev) => ({ ...prev, [provider.id]: { state: "success", latencyMs } }));
      } else if (reason === "unsupported") {
        setPingState((prev) => ({ ...prev, [provider.id]: { state: "unsupported" } }));
      } else if (reason === "inactive" || reason === "incomplete") {
        // Derived state already covers this — clear any stale ping result.
        setPingState((prev) => ({ ...prev, [provider.id]: { state: "idle" } }));
      } else {
        setPingState((prev) => ({ ...prev, [provider.id]: { state: "error", reason, message } }));
      }
    } catch {
      setPingState((prev) => ({
        ...prev,
        [provider.id]: { state: "error", message: "Network error while testing connection" },
      }));
    }
  }, []);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/internal/payment-providers");
      const json = await res.json();
      if (json.success) {
        const list: PaymentProvider[] = json.data;
        setProviders(list);
        // Auto-ping anything that's active and fully configured — no point
        // pinging gateways we already know are off or missing credentials.
        list
          .filter((p) => p.isActive && p.publicKey && p.secretKey && p.webhookSecret)
          .forEach((p) => testConnection(p));
      } else {
        setError(json.error);
      }
    } catch {
      setError("Failed to fetch providers");
    } finally {
      setLoading(false);
    }
  }, [testConnection]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleInputChange = (id: string, field: keyof PaymentProvider, value: any) => {
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/payment-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newId, name: newName, isActive: false }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error);
      } else {
        setShowModal(false);
        setNewId("");
        setNewName("");
        await fetchProviders();
        setExpandedId(newId);
        setToast(`${newName} added`);
      }
    } catch {
      setError("Network error while creating provider.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSave = async (provider: PaymentProvider) => {
    setSavingId(provider.id);
    setError(null);
    try {
      const res = await fetch(`/api/internal/payment-providers/${provider.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: provider.isActive,
          publicKey: provider.publicKey,
          secretKey: provider.secretKey,
          webhookSecret: provider.webhookSecret,
          feePercentage: Number(provider.feePercentage) || 0,
          feeCap: Number(provider.feeCap) || 0,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error);
      } else {
        setToast(`${provider.name} saved`);
        // Credentials may have just changed — re-test for real instead of
        // leaving a stale status on screen.
        testConnection(provider);
      }
    } catch {
      setError("A network error occurred while saving.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name}? This can't be fully undone.`)) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/internal/payment-providers/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) setError(json.error);
      else {
        setProviders((prev) => prev.filter((p) => p.id !== id));
        setToast(`${name} removed`);
      }
    } catch {
      setError("A network error occurred while deleting.");
    } finally {
      setDeletingId(null);
    }
  };

  const toggleVisible = (key: string) => setVisible((prev) => ({ ...prev, [key]: !prev[key] }));

  const copyValue = async (key: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const statuses = providers.map((p) => getConnectionStatus(p, pingState[p.id]));
  const connectedCount = statuses.filter((s) => s === "connected").length;
  const unreachableCount = statuses.filter((s) => s === "unreachable").length;

  return (
    <div className="max-w-4xl p-6 mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment gateways</h1>
          <p className="mt-1 text-sm text-gray-500">
            Connect and manage the processors used for wallet funding, payouts, and virtual accounts.
          </p>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          className="gap-1.5 bg-[#F97316] hover:bg-[#EA6A0C] text-white shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add gateway
        </Button>
      </div>

      {/* Summary strip */}
      {!loading && providers.length > 0 && (
        <div className="flex items-center gap-6 px-4 py-3 text-sm bg-white border border-gray-200 rounded-lg">
          <span className="text-gray-600">
            <span className="font-semibold text-gray-900">{providers.length}</span> gateway
            {providers.length === 1 ? "" : "s"}
          </span>
          <span className="w-px h-4 bg-gray-200" />
          <span className="flex items-center gap-1.5 text-gray-600">
            <ConnectionDot status="connected" />
            <span className="font-semibold text-gray-900">{connectedCount}</span> connected
          </span>
          {unreachableCount > 0 && (
            <span className="flex items-center gap-1.5 text-gray-600">
              <ConnectionDot status="unreachable" />
              <span className="font-semibold text-gray-900">{unreachableCount}</span> unreachable
            </span>
          )}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2.5 p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="overflow-hidden bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-4 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="w-32 h-3.5 bg-gray-200 rounded" />
                <div className="w-20 h-3 bg-gray-100 rounded" />
              </div>
              <div className="w-11 h-6 bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && providers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-dashed border-gray-300 rounded-lg">
          <div className="flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-orange-50">
            <CreditCard className="w-6 h-6 text-[#F97316]" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">No payment gateways yet</h3>
          <p className="max-w-sm mt-1 text-sm text-gray-500">
            Add a gateway to start accepting wallet funding and processing payouts.
          </p>
          <Button
            onClick={() => setShowModal(true)}
            className="gap-1.5 mt-4 bg-[#F97316] hover:bg-[#EA6A0C] text-white"
          >
            <Plus className="w-4 h-4" />
            Add gateway
          </Button>
        </div>
      )}

      {/* Connections list */}
      {!loading && providers.length > 0 && (
        <div className="overflow-hidden bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {providers.map((provider) => {
            const ping = pingState[provider.id];
            const status = getConnectionStatus(provider, ping);
            const meta = STATUS_META[status];
            const isExpanded = expandedId === provider.id;
            const canRetest = provider.isActive && !!provider.publicKey && !!provider.secretKey && !!provider.webhookSecret;

            return (
              <div key={provider.id}>
                {/* Row */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : provider.id)}
                  className="flex items-center w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="relative shrink-0">
                    <div className="flex items-center justify-center w-10 h-10 text-sm font-semibold text-white rounded-full bg-gradient-to-br from-[#F97316] to-[#EA6A0C]">
                      {initials(provider.name)}
                    </div>
                    <ConnectionDot status={status} size="corner" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 truncate">{provider.name}</span>
                      <code className="px-1.5 py-0.5 text-[11px] font-mono text-gray-500 bg-gray-100 rounded shrink-0">
                        {provider.id}
                      </code>
                    </div>
                    <span className={`text-xs font-medium ${meta.text}`}>
                      {meta.label}
                      {status === "connected" && ping?.state === "success" && ping.latencyMs != null && (
                        <span className="text-gray-400"> · {ping.latencyMs}ms</span>
                      )}
                      {status === "unreachable" && ping?.state === "error" && ping.message && (
                        <span className="text-gray-400"> · {ping.message}</span>
                      )}
                    </span>
                  </div>

                  {canRetest && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        testConnection(provider);
                      }}
                      disabled={status === "checking"}
                      className="p-1.5 text-gray-400 rounded hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50 shrink-0"
                      aria-label="Test connection"
                      title="Test connection"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${status === "checking" ? "animate-spin" : ""}`} />
                    </button>
                  )}

                  <span
                    role="switch"
                    aria-checked={provider.isActive}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInputChange(provider.id, "isActive", !provider.isActive);
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                      provider.isActive ? "bg-[#F97316]" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block w-4 h-4 transform bg-white rounded-full shadow transition-transform ${
                        provider.isActive ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </span>

                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-5 pb-5 -mt-1 bg-gray-50/60">
                    <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-3">
                      {SECRET_FIELDS.map(({ key, label, placeholder }) => {
                        const fieldKey = `${provider.id}:${key}`;
                        const isVisible = !!visible[fieldKey];
                        const value = provider[key] || "";
                        return (
                          <div key={key}>
                            <label className="block mb-1 text-xs font-medium text-gray-600">{label}</label>
                            <div className="relative flex items-center">
                              <input
                                type={isVisible ? "text" : "password"}
                                className="w-full px-3 py-2 pr-16 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]"
                                value={value}
                                placeholder={placeholder}
                                onChange={(e) => handleInputChange(provider.id, key, e.target.value)}
                              />
                              <div className="absolute right-1.5 flex items-center gap-0.5">
                                <button
                                  type="button"
                                  tabIndex={-1}
                                  onClick={() => toggleVisible(fieldKey)}
                                  className="p-1.5 text-gray-400 rounded hover:text-gray-600 hover:bg-gray-100"
                                  aria-label={isVisible ? "Hide value" : "Show value"}
                                >
                                  {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  tabIndex={-1}
                                  onClick={() => copyValue(fieldKey, value)}
                                  disabled={!value}
                                  className="p-1.5 text-gray-400 rounded hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                                  aria-label="Copy value"
                                >
                                  {copied === fieldKey ? (
                                    <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Live status detail */}
                    <div className="flex items-center gap-2 px-3 py-2 mt-4 text-xs bg-white border border-gray-200 rounded-md">
                      <ConnectionDot status={status} />
                      <span className={`font-medium ${meta.text}`}>{meta.label}</span>
                      {status === "unsupported" && (
                        <span className="text-gray-400">
                          — no handshake is wired up for "{provider.id}" yet
                        </span>
                      )}
                      {status === "unreachable" && ping?.state === "error" && ping.message && (
                        <span className="text-gray-400">— {ping.message}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => testConnection(provider)}
                        disabled={!canRetest || status === "checking"}
                        className="flex items-center gap-1 ml-auto font-medium text-gray-500 hover:text-gray-700 disabled:opacity-40"
                      >
                        <RefreshCw className={`w-3 h-3 ${status === "checking" ? "animate-spin" : ""}`} />
                        Test connection
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 mt-4 border-t border-gray-200 sm:w-1/2">
                      <div>
                        <label className="block mb-1 text-xs font-medium text-gray-600">Fee</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            className="w-full px-3 py-2 pr-8 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]"
                            value={provider.feePercentage ?? ""}
                            placeholder="0.00"
                            onChange={(e) => handleInputChange(provider.id, "feePercentage", e.target.value)}
                          />
                          <span className="absolute text-xs text-gray-400 -translate-y-1/2 right-3 top-1/2">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block mb-1 text-xs font-medium text-gray-600">Fee cap</label>
                        <div className="relative">
                          <input
                            type="number"
                            className="w-full px-3 py-2 pl-12 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]"
                            value={provider.feeCap ?? ""}
                            placeholder="0"
                            onChange={(e) => handleInputChange(provider.id, "feeCap", e.target.value)}
                          />
                          <span className="absolute text-xs text-gray-400 -translate-y-1/2 left-3 top-1/2">kobo</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 mt-1">
                      <button
                        onClick={() => handleDelete(provider.id, provider.name)}
                        disabled={deletingId === provider.id}
                        className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {deletingId === provider.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Remove gateway
                      </button>
                      <Button
                        onClick={() => handleSave(provider)}
                        disabled={savingId === provider.id}
                        className="gap-1.5 bg-[#F97316] hover:bg-[#EA6A0C] text-white"
                      >
                        {savingId === provider.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {savingId === provider.id ? "Saving" : "Save changes"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowModal(false)}
        >
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Add payment gateway</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 rounded hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Gateway ID</label>
                <input
                  required
                  type="text"
                  pattern="[a-z0-9_-]+"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  placeholder="e.g. flutterwave, paystack"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Use "flutterwave" for a live connection test. Other IDs will show as "Can't verify" until a
                  matching gateway implementation exists.
                </p>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Display name</label>
                <input
                  required
                  type="text"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Flutterwave"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating} className="gap-1.5 bg-[#F97316] hover:bg-[#EA6A0C] text-white">
                  {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isCreating ? "Creating" : "Create gateway"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
          {toast}
        </div>
      )}
    </div>
  );
}