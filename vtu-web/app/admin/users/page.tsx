// vtu-web/app/admin/users/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Filter,
  MoreHorizontal,
  UserCheck,
  UserX,
  Shield,
  Wallet,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Lock,
  Unlock,
  UserCog,
  Download,
  SlidersHorizontal,
  TrendingUp,
  Users,
  EyeIcon,
  Loader2,
} from "lucide-react";
import { ApiResponse, PermissionGroups, RoleRecord } from "@/types";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useRouter } from "next/navigation";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const B = {
  orange: "#F97316",
  orangeDark: "#EA580C",
  green: "#22C55E",
  text: "#111827",
  muted: "#6B7280",
  faint: "#9CA3AF",
  border: "#E5E7EB",
  surface: "#F9FAFB",
  white: "#FFFFFF",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserRecord {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  roleId: string;
  kycTier: 0 | 1 | 2 | 3;
  isActive: boolean;
  isFrozen: boolean;
  riskLevel: "low" | "medium" | "high";
  subscriptionPlanId: string;
  createdAt: { _seconds: number } | string;
  walletBalance?: number;
}

interface UsersPayload {
  users: UserRecord[];
  pagination?: { page: number; pageSize: number; hasMore: boolean };
}

type FilterStatus = "all" | "active" | "frozen" | "suspended";
type FilterKyc = "all" | "0" | "1" | "2" | "3";
type FilterRisk = "all" | "low" | "medium" | "high";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(ts: { _seconds: number } | string | undefined): string {
  if (!ts) return "—";
  const d =
    typeof ts === "string"
      ? new Date(ts)
      : new Date((ts as { _seconds: number })._seconds * 1000);
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function kycLabel(tier: number) {
  return ["None", "Basic", "Enhanced", "Full"][tier] ?? "None";
}

function kycColor(tier: number) {
  return [B.faint, "#F59E0B", B.orange, B.green][tier] ?? B.faint;
}

function riskColor(r: string) {
  return r === "high" ? "#DC2626" : r === "medium" ? "#D97706" : "#059669";
}

function statusChip(user: UserRecord) {
  if (!user.isActive)
    return { label: "Suspended", bg: "#FEF2F2", color: "#DC2626", icon: <XCircle size={11} /> };
  if (user.isFrozen)
    return { label: "Frozen", bg: "#EFF6FF", color: "#2563EB", icon: <Lock size={11} /> };
  return { label: "Active", bg: "#ECFDF5", color: "#059669", icon: <CheckCircle size={11} /> };
}

// ─── Impersonation confirm modal ──────────────────────────────────────────────
function ImpersonateModal({
  user,
  loading,
  error,
  onConfirm,
  onCancel,
}: {
  user: UserRecord;
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        style={{ border: `1px solid ${B.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(249,115,22,0.1)' }}>
          <EyeIcon size={22} style={{ color: B.orange }} />
        </div>
        <h3 className="text-base font-bold" style={{ color: B.text }}>
          Impersonate {user.displayName}?
        </h3>
        <p className="mt-1 text-sm" style={{ color: B.muted }}>
          You'll view the platform exactly as this user. All your actions will be logged.
          Financial operations (debit, withdrawal, transfer) are blocked during impersonation.
          The session expires automatically after 15 minutes.
        </p>

        <div
          className="mt-4 rounded-xl p-3 text-sm"
          style={{ background: B.surface, color: B.muted, border: `1px solid ${B.border}` }}
        >
          <p><span className="font-semibold" style={{ color: B.text }}>User:</span> {user.displayName}</p>
          <p><span className="font-semibold" style={{ color: B.text }}>Email:</span> {user.email}</p>
          <p><span className="font-semibold" style={{ color: B.text }}>Role:</span> {user.roleId}</p>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-2xl border py-2.5 text-sm font-semibold transition hover:bg-gray-50 disabled:opacity-50"
            style={{ borderColor: B.border, color: B.text }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <EyeIcon size={14} />}
            {loading ? 'Starting…' : 'Impersonate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Action menu ──────────────────────────────────────────────────────────────
function ActionMenu({
  user,
  onAction,
}: {
  user: UserRecord;
  onAction: (action: string, user: UserRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + window.scrollY + 4, right: window.innerWidth - rect.right });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", fn);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", fn);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const items = [
    { id: "view", label: "View profile", icon: <Eye size={14} /> },
    { id: "assign-role", label: "Assign role", icon: <UserCog size={14} /> },
    { id: "impersonate", label: "Impersonate", icon: <EyeIcon size={14} />, color: B.orange },
    { id: "wallet", label: "View wallet", icon: <Wallet size={14} /> },
    null,
    user.isFrozen
      ? { id: "unfreeze", label: "Unfreeze wallet", icon: <Unlock size={14} />, color: "#059669" }
      : { id: "freeze", label: "Freeze wallet", icon: <Lock size={14} />, color: "#D97706" },
    user.isActive
      ? { id: "suspend", label: "Suspend account", icon: <UserX size={14} />, color: "#DC2626" }
      : { id: "activate", label: "Activate account", icon: <UserCheck size={14} />, color: "#059669" },
  ];

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-gray-100"
        style={{ color: B.muted }}
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div
          ref={menuRef}
          className="fixed z-[9999] w-52 rounded-xl border bg-white py-1 shadow-xl"
          style={{ top: menuPos.top, right: menuPos.right, borderColor: B.border }}
        >
          {items.map((item, i) =>
            item === null ? (
              <div key={i} className="my-1 border-t" style={{ borderColor: B.border }} />
            ) : (
              <button
                key={item.id}
                onClick={() => { onAction(item.id, user); setOpen(false); }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition hover:bg-gray-50"
                style={{ color: (item as { color?: string }).color ?? B.text }}
              >
                {item.icon}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </>
  );
}

// ─── Stats strip ──────────────────────────────────────────────────────────────
function StatsStrip({ users }: { users: UserRecord[] }) {
  const total = users.length;
  const active = users.filter((u) => u.isActive && !u.isFrozen).length;
  const frozen = users.filter((u) => u.isFrozen).length;
  const suspended = users.filter((u) => !u.isActive).length;
  const highRisk = users.filter((u) => u.riskLevel === "high").length;

  const stats = [
    { label: "Total", value: total, icon: <Users size={15} />, color: B.orange },
    { label: "Active", value: active, icon: <CheckCircle size={15} />, color: "#059669" },
    { label: "Frozen", value: frozen, icon: <Lock size={15} />, color: "#2563EB" },
    { label: "Suspended", value: suspended, icon: <XCircle size={15} />, color: "#DC2626" },
    { label: "High Risk", value: highRisk, icon: <AlertTriangle size={15} />, color: "#D97706" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-3 rounded-2xl border bg-white p-4" style={{ borderColor: B.border }}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${s.color}18`, color: s.color }}>
            {s.icon}
          </div>
          <div>
            <p className="text-xl font-bold leading-none" style={{ color: B.text }}>{s.value}</p>
            <p className="mt-0.5 text-xs" style={{ color: B.faint }}>{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
function ConfirmModal({
  title, message, confirmLabel, confirmColor, loading, error, note, onNote, onConfirm, onCancel,
}: {
  title: string; message: string; confirmLabel: string; confirmColor: string;
  loading: boolean; error: string | null; note: string;
  onNote: (v: string) => void; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" style={{ border: `1px solid ${B.border}` }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold" style={{ color: B.text }}>{title}</h3>
        <p className="mt-1 text-sm" style={{ color: B.muted }}>{message}</p>
        <textarea
          className="mt-4 w-full resize-none rounded-xl border p-3 text-sm outline-none focus:ring-2"
          style={{ borderColor: B.border, color: B.text, minHeight: 72 }}
          placeholder="Reason (required)"
          value={note}
          onChange={(e) => onNote(e.target.value)}
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button onClick={onCancel} disabled={loading} className="flex-1 rounded-2xl border py-2.5 text-sm font-semibold transition hover:bg-gray-50 disabled:opacity-50" style={{ borderColor: B.border, color: B.text }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading || !note.trim()} className="flex-1 rounded-2xl py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: confirmColor }}>
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Role modal ───────────────────────────────────────────────────────────────
function RoleModal({
  user, roles, loading, error, onConfirm, onCancel,
}: {
  user: UserRecord; loading: boolean; error: string | null;
  onConfirm: (roleId: string) => void; onCancel: () => void; roles: RoleRecord[];
}) {
  const [selected, setSelected] = useState(user.roleId);
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" style={{ border: `1px solid ${B.border}` }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold" style={{ color: B.text }}>Assign role — {user.displayName}</h3>
        <p className="mb-4 mt-1 text-sm" style={{ color: B.muted }}>Current role: <strong>{user.roleId}</strong></p>
        <div className="space-y-1.5">
          {roles.map((r) => (
            <button key={r.id} onClick={() => setSelected(r.id)}
              className="flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition"
              style={{ borderColor: selected === r.id ? B.orange : B.border, background: selected === r.id ? "rgba(249,115,22,0.06)" : B.white, color: B.text }}>
              <div className="h-4 w-4 shrink-0 rounded-full border-2" style={{ borderColor: selected === r.id ? B.orange : B.border, background: selected === r.id ? B.orange : "transparent" }} />
              {r.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button onClick={onCancel} disabled={loading} className="flex-1 rounded-2xl border py-2.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50" style={{ borderColor: B.border, color: B.text }}>Cancel</button>
          <button onClick={() => onConfirm(selected)} disabled={loading || selected === user.roleId}
            className="flex-1 rounded-2xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#F97316,#EA580C)" }}>
            {loading ? "Saving…" : "Assign role"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mobile user card ─────────────────────────────────────────────────────────
function UserCard({ user, onAction }: { user: UserRecord; onAction: (action: string, user: UserRecord) => void }) {
  const chip = statusChip(user);
  return (
    <div className="rounded-2xl border bg-white p-4" style={{ borderColor: B.border }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#F97316,#EA580C)" }}>
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold" style={{ color: B.text }}>{user.displayName}</p>
            <p className="truncate text-xs" style={{ color: B.faint }}>{user.email}</p>
          </div>
        </div>
        <ActionMenu user={user} onAction={onAction} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold" style={{ background: chip.bg, color: chip.color }}>
          {chip.icon}{chip.label}
        </span>
        <span className="inline-block rounded-lg px-2 py-0.5 text-xs font-bold" style={{ background: `${kycColor(user.kycTier)}18`, color: kycColor(user.kycTier) }}>
          KYC T{user.kycTier}
        </span>
        <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold" style={{ background: B.surface, color: B.muted }}>
          <Shield size={10} />{user.roleId.replace(/_/g, " ")}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold capitalize" style={{ color: riskColor(user.riskLevel) }}>
          <TrendingUp size={10} />{user.riskLevel}
        </span>
      </div>
      <p className="mt-2 flex items-center gap-1 text-xs" style={{ color: B.faint }}>
        <Clock size={10} />{formatDate(user.createdAt)}
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 20;

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterKyc, setFilterKyc] = useState<FilterKyc>("all");
  const [filterRisk, setFilterRisk] = useState<FilterRisk>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Action modals
  type ModalKind = "freeze" | "unfreeze" | "suspend" | "activate" | null;
  const [modalKind, setModalKind] = useState<ModalKind>(null);
  const [modalUser, setModalUser] = useState<UserRecord | null>(null);
  const [note, setNote] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Role modal
  const [roleModal, setRoleModal] = useState(false);
  const [roleUser, setRoleUser] = useState<UserRecord | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleRecord[]>([]);

  // Impersonation
  const { start: startImpersonation, loading: impersonationLoading, error: impersonationError, setError: setImpersonationError } = useImpersonation();
  const [impersonateModal, setImpersonateModal] = useState(false);
  const [impersonateUser, setImpersonateUser] = useState<UserRecord | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set("search", search);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterKyc !== "all") params.set("kycTier", filterKyc);
      if (filterRisk !== "all") params.set("riskLevel", filterRisk);

      const res = await fetch(`/api/internal/users?${params}`);
      const json: ApiResponse<UsersPayload> = await res.json();
      if (!json.success || !json.data) throw new Error((json as any).error ?? "Failed to load users");
      setUsers(json.data.users ?? []);
      setHasMore(json.data.pagination?.hasMore ?? false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus, filterKyc, filterRisk]);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/internal/roles");
      const json: ApiResponse<{ roles: RoleRecord[] }> = await res.json();
      setRoles((json as any).data?.roles ?? []);
    } catch {}
  }, []);

  useEffect(() => { fetchUsers(); fetchRoles(); }, [fetchUsers]);

  // ── Action handler ─────────────────────────────────────────────────────────
  const handleAction = (action: string, user: UserRecord) => {
    if (action === "view") {
      router.push(`/admin/users/${user.uid}`);
      return;
    }
    if (action === "assign-role") {
      setRoleUser(user); setRoleModal(true); setRoleError(null);
      return;
    }
    if (action === "impersonate") {
      setImpersonateUser(user); setImpersonateModal(true); setImpersonationError(null);
      return;
    }
    if (["freeze", "unfreeze", "suspend", "activate"].includes(action)) {
      setModalKind(action as ModalKind); setModalUser(user); setNote(""); setModalError(null);
    }
  };

  // ── Confirm freeze/suspend ─────────────────────────────────────────────────
  const confirmAction = async () => {
    if (!modalUser || !note.trim()) return;
    setModalLoading(true); setModalError(null);
    try {
      if (modalKind === "freeze" || modalKind === "unfreeze") {
        const res = await fetch("/api/internal/wallet/freeze", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: modalUser.uid, action: modalKind, reason: note }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
      } else {
        const res = await fetch("/api/internal/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: modalUser.uid, isActive: modalKind === "activate", reason: note }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
      }
      setModalKind(null); setModalUser(null); fetchUsers();
    } catch (e: unknown) {
      setModalError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setModalLoading(false);
    }
  };

  // ── Assign role ────────────────────────────────────────────────────────────
  const confirmRole = async (roleId: string) => {
    if (!roleUser) return;
    setRoleLoading(true); setRoleError(null);
    try {
      const res = await fetch("/api/internal/roles/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: roleUser.uid, roleId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRoleModal(false); setRoleUser(null); fetchUsers();
    } catch (e: unknown) {
      setRoleError(e instanceof Error ? e.message : "Failed to assign role");
    } finally {
      setRoleLoading(false);
    }
  };

  // ── Start impersonation ────────────────────────────────────────────────────
  const confirmImpersonate = async () => {
    if (!impersonateUser) return;
    try {
      await startImpersonation(impersonateUser.uid);
      setImpersonateModal(false);
      setImpersonateUser(null);
      // Redirect to dashboard to view as user
      router.push("/dashboard");
    } catch {
      // error is stored in impersonationError from the hook
    }
  };

  // ── Client-side filter ────────────────────────────────────────────────────
  const visible = users.filter((u) => {
    if (search) {
      const q = search.toLowerCase();
      if (!u.displayName.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !u.phone.includes(q)) return false;
    }
    return true;
  });

  const modalConfig: Record<string, { title: string; message: string; confirmLabel: string; confirmColor: string }> = {
    freeze: { title: "Freeze wallet", message: `${modalUser?.displayName} will be unable to transact until you unfreeze their wallet.`, confirmLabel: "Freeze wallet", confirmColor: "#2563EB" },
    unfreeze: { title: "Unfreeze wallet", message: `${modalUser?.displayName}'s wallet will be restored to normal.`, confirmLabel: "Unfreeze wallet", confirmColor: "#059669" },
    suspend: { title: "Suspend account", message: `${modalUser?.displayName} will be locked out of their account.`, confirmLabel: "Suspend account", confirmColor: "#DC2626" },
    activate: { title: "Activate account", message: `${modalUser?.displayName}'s account will be restored.`, confirmLabel: "Activate account", confirmColor: "#059669" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: B.text }}>Users</h1>
          <p className="text-sm" style={{ color: B.muted }}>Manage accounts, roles, and wallet access.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchUsers} disabled={loading} className="flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm transition hover:bg-gray-50 disabled:opacity-50" style={{ borderColor: B.border, color: B.muted }}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh
          </button>
          <button className="flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm transition hover:bg-gray-50" style={{ borderColor: B.border, color: B.muted }}>
            <Download size={14} />Export
          </button>
        </div>
      </div>

      {/* Stats */}
      {!loading && !error && <StatsStrip users={users} />}

      {/* Search + Filters */}
      <div className="rounded-2xl border bg-white p-4" style={{ borderColor: B.border }}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: B.faint }} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, email, or phone…"
              className="h-9 w-full rounded-xl border pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-orange-200"
              style={{ borderColor: B.border, color: B.text }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: B.faint }}>
                <X size={13} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters((f) => !f)}
            className="flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm transition"
            style={{ borderColor: showFilters ? B.orange : B.border, background: showFilters ? "rgba(249,115,22,0.06)" : B.white, color: showFilters ? B.orange : B.muted }}
          >
            <SlidersHorizontal size={14} />Filters
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-3" style={{ borderColor: B.border }}>
            {[
              { label: "STATUS", value: filterStatus, onChange: (v: string) => { setFilterStatus(v as FilterStatus); setPage(1); }, options: [["all", "All statuses"], ["active", "Active"], ["frozen", "Frozen"], ["suspended", "Suspended"]] },
              { label: "KYC TIER", value: filterKyc, onChange: (v: string) => { setFilterKyc(v as FilterKyc); setPage(1); }, options: [["all", "All tiers"], ["0", "Tier 0 — None"], ["1", "Tier 1 — Basic"], ["2", "Tier 2 — Enhanced"], ["3", "Tier 3 — Full"]] },
              { label: "RISK LEVEL", value: filterRisk, onChange: (v: string) => { setFilterRisk(v as FilterRisk); setPage(1); }, options: [["all", "All risk levels"], ["low", "Low"], ["medium", "Medium"], ["high", "High"]] },
            ].map(({ label, value, onChange, options }) => (
              <div key={label}>
                <label className="mb-1 block text-xs font-semibold" style={{ color: B.faint }}>{label}</label>
                <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-full rounded-lg border px-2 text-sm outline-none" style={{ borderColor: B.border, color: B.text }}>
                  {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border px-5 py-4" style={{ background: "#FEF2F2", borderColor: "#FECACA" }}>
          <AlertTriangle size={16} color="#DC2626" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={fetchUsers} className="ml-auto text-sm font-semibold text-red-700 underline">Retry</button>
        </div>
      )}

      {/* Mobile list */}
      <div className="md:hidden space-y-3">
        {loading ? Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl border bg-white p-4" style={{ borderColor: B.border }}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full" style={{ background: B.border }} />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded" style={{ background: B.border }} />
                <div className="h-3 w-48 rounded" style={{ background: B.border }} />
              </div>
            </div>
          </div>
        )) : visible.length === 0 ? (
          <div className="rounded-2xl border bg-white py-16 text-center" style={{ borderColor: B.border, color: B.faint }}>
            <Users size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No users found</p>
          </div>
        ) : visible.map((user) => <UserCard key={user.uid} user={user} onAction={handleAction} />)}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-2xl border bg-white" style={{ borderColor: B.border }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: B.border }}>
              {["User", "Role", "KYC", "Status", "Risk", "Joined", ""].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: B.faint, background: B.surface }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b" style={{ borderColor: B.border }}>
                {Array.from({ length: 7 }).map((__, j) => (
                  <td key={j} className="px-5 py-4">
                    <div className="h-4 animate-pulse rounded" style={{ background: B.border, width: j === 0 ? 160 : 60 }} />
                  </td>
                ))}
              </tr>
            )) : visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center" style={{ color: B.faint }}>
                  <Users size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No users found</p>
                </td>
              </tr>
            ) : visible.map((user) => {
              const chip = statusChip(user);
              return (
                <tr key={user.uid} className="border-b transition-colors hover:bg-gray-50" style={{ borderColor: B.border }}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#F97316,#EA580C)" }}>
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold" style={{ color: B.text }}>{user.displayName}</p>
                        <p className="truncate text-xs" style={{ color: B.faint }}>{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold" style={{ background: B.surface, color: B.muted }}>
                      <Shield size={10} />{user.roleId.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-block rounded-lg px-2 py-0.5 text-xs font-bold" style={{ background: `${kycColor(user.kycTier)}18`, color: kycColor(user.kycTier) }}>
                      T{user.kycTier} {kycLabel(user.kycTier)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold" style={{ background: chip.bg, color: chip.color }}>
                      {chip.icon}{chip.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold capitalize" style={{ color: riskColor(user.riskLevel) }}>
                      <TrendingUp size={11} />{user.riskLevel}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-1 text-xs" style={{ color: B.muted }}>
                      <Clock size={11} />{formatDate(user.createdAt)}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <ActionMenu user={user} onAction={handleAction} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {!loading && visible.length > 0 && (
          <div className="flex items-center justify-between border-t px-5 py-3" style={{ borderColor: B.border }}>
            <p className="text-xs" style={{ color: B.faint }}>Page {page} · {visible.length} record{visible.length !== 1 ? "s" : ""}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-gray-50 disabled:opacity-40" style={{ borderColor: B.border }}>
                <ChevronLeft size={15} style={{ color: B.muted }} />
              </button>
              <span className="text-xs font-semibold" style={{ color: B.text }}>{page}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={!hasMore} className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-gray-50 disabled:opacity-40" style={{ borderColor: B.border }}>
                <ChevronRight size={15} style={{ color: B.muted }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile pagination */}
      {!loading && visible.length > 0 && (
        <div className="flex items-center justify-between md:hidden">
          <p className="text-xs" style={{ color: B.faint }}>Page {page} · {visible.length} records</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-gray-50 disabled:opacity-40" style={{ borderColor: B.border }}>
              <ChevronLeft size={15} style={{ color: B.muted }} />
            </button>
            <span className="text-xs font-semibold" style={{ color: B.text }}>{page}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={!hasMore} className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-gray-50 disabled:opacity-40" style={{ borderColor: B.border }}>
              <ChevronRight size={15} style={{ color: B.muted }} />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {modalKind && modalUser && (
        <ConfirmModal
          {...modalConfig[modalKind]}
          loading={modalLoading} error={modalError} note={note} onNote={setNote}
          onConfirm={confirmAction} onCancel={() => { setModalKind(null); setModalUser(null); }}
        />
      )}
      {roleModal && roleUser && (
        <RoleModal
          user={roleUser} roles={roles} loading={roleLoading} error={roleError}
          onConfirm={confirmRole} onCancel={() => { setRoleModal(false); setRoleUser(null); }}
        />
      )}
      {impersonateModal && impersonateUser && (
        <ImpersonateModal
          user={impersonateUser}
          loading={impersonationLoading}
          error={impersonationError}
          onConfirm={confirmImpersonate}
          onCancel={() => { setImpersonateModal(false); setImpersonateUser(null); setImpersonationError(null); }}
        />
      )}
    </div>
  );
}