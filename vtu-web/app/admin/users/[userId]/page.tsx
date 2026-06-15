// vtu-web/app/admin/users/[userId]/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Wallet,
  Shield,
  Phone,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  Lock,
  Unlock,
  AlertTriangle,
  RefreshCw,
  Copy,
  ExternalLink,
  ChevronRight,
  Clock,
  TrendingUp,
  CreditCard,
  Settings,
  Eye,
  EyeOff,
  UserCog,
  Activity,
  FileText,
  BarChart2,
  BadgeCheck,
  Ban,
  Loader2,
  CircleDot,
  Hash,
  Zap,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const B = {
  orange: '#F97316',
  orangeDark: '#EA580C',
  green: '#22C55E',
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  surface: '#F9FAFB',
  white: '#FFFFFF',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserDetail {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  avatar: string | null;
  roleId: string;
  kycTier: 0 | 1 | 2 | 3;
  isActive: boolean;
  isFrozen: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  subscriptionPlanId: string;
  subscriptionExpiresAt: { _seconds: number } | null;
  referralCode: string;
  referredBy: string | null;
  hasBucket: boolean;
  resellerLevel: number;
  transactionPin: string | null;
  spendingLimits: {
    dailyLimit: number | null;
    weeklyLimit: number | null;
    dailySpent: number;
    weeklySpent: number;
    lastResetDate: string;
  };
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
    whatsapp: boolean;
  };
  createdAt: { _seconds: number };
  updatedAt: { _seconds: number };
}

interface WalletDetail {
  balance: number;
  currency: string;
  virtualAccountNumber: string;
  virtualAccountBank: string;
  totalFunded: number;
  totalSpent: number;
  totalWithdrawn: number;
  lockedBalance: number;
}

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  category: string;
  amount: number;
  fee: number;
  status: 'pending' | 'success' | 'failed' | 'reversed' | 'disputed';
  reference: string;
  createdAt: { _seconds: number };
  provider: string | null;
  metadata: Record<string, unknown>;
}

interface PageData {
  user: UserDetail;
  wallet: WalletDetail | null;
  recentTransactions: Transaction[];
  referralCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(ts: { _seconds: number } | null | undefined, withTime = false): string {
  if (!ts) return '—';
  const d = new Date(ts._seconds * 1000);
  return withTime
    ? d.toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatKobo(kobo: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(kobo / 100);
}

function kycLabel(tier: number) {
  return ['None', 'Basic', 'Enhanced', 'Full'][tier] ?? 'None';
}
function kycColor(tier: number) {
  return [B.faint, '#F59E0B', B.orange, B.green][tier] ?? B.faint;
}
function riskColor(r: string) {
  return r === 'high' ? '#DC2626' : r === 'medium' ? '#D97706' : '#059669';
}
function statusColor(s: string) {
  if (s === 'success') return { bg: '#ECFDF5', text: '#059669' };
  if (s === 'failed') return { bg: '#FEF2F2', text: '#DC2626' };
  if (s === 'pending') return { bg: '#FFFBEB', text: '#D97706' };
  if (s === 'reversed') return { bg: '#EFF6FF', text: '#2563EB' };
  return { bg: B.surface, text: B.muted };
}
function categoryLabel(cat: string) {
  const map: Record<string, string> = {
    airtime: 'Airtime', data: 'Data', electricity: 'Electricity', cable: 'Cable TV',
    wallet_fund: 'Wallet Fund', withdrawal: 'Withdrawal', transfer: 'Transfer',
    refund: 'Refund', commission: 'Commission', cashback: 'Cashback', fee: 'Fee',
    exam_pin: 'Exam Pin', sms: 'Bulk SMS', internet: 'Internet',
    loan_disbursement: 'Loan', loan_repayment: 'Loan Repayment',
    bucket_purchase: 'Bucket', airtime_to_cash: 'Airtime to Cash',
  };
  return map[cat] ?? cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4" style={{ borderColor: B.border }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: B.faint }}>{label}</p>
      <p className="text-xl font-bold leading-tight" style={{ color: B.text }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: B.faint }}>{sub}</p>}
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white" style={{ borderColor: B.border }}>
      <div className="flex items-center gap-2 border-b px-5 py-3.5" style={{ borderColor: B.border }}>
        {icon && <span style={{ color: B.orange }}>{icon}</span>}
        <h3 className="text-sm font-bold" style={{ color: B.text }}>{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono = false, copy = false }: { label: string; value: React.ReactNode; mono?: boolean; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (typeof value === 'string') {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b last:border-b-0" style={{ borderColor: B.border }}>
      <span className="text-xs font-semibold shrink-0 mt-0.5" style={{ color: B.faint, minWidth: 130 }}>{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-sm text-right break-all ${mono ? 'font-mono' : ''}`} style={{ color: B.text }}>{value}</span>
        {copy && typeof value === 'string' && (
          <button onClick={handleCopy} className="shrink-0" title="Copy">
            {copied ? <CheckCircle size={13} color="#059669" /> : <Copy size={13} color={B.faint} />}
          </button>
        )}
      </div>
    </div>
  );
}

function Badge({ label, bg, color, icon }: { label: string; bg: string; color: string; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold" style={{ background: bg, color }}>
      {icon}{label}
    </span>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function ConfirmModal({
  title, message, confirmLabel, confirmColor, loading, error,
  note, onNote, onConfirm, onCancel,
}: {
  title: string; message: string; confirmLabel: string; confirmColor: string;
  loading: boolean; error: string | null;
  note: string; onNote: (v: string) => void;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" style={{ border: `1px solid ${B.border}` }} onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold" style={{ color: B.text }}>{title}</h3>
        <p className="mt-1 text-sm" style={{ color: B.muted }}>{message}</p>
        <textarea
          className="mt-4 w-full resize-none rounded-xl border p-3 text-sm outline-none focus:ring-2 focus:ring-orange-200"
          style={{ borderColor: B.border, color: B.text, minHeight: 72 }}
          placeholder="Reason (required)"
          value={note}
          onChange={e => onNote(e.target.value)}
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button onClick={onCancel} disabled={loading} className="flex-1 rounded-2xl border py-2.5 text-sm font-semibold transition hover:bg-gray-50 disabled:opacity-50" style={{ borderColor: B.border, color: B.text }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading || !note.trim()} className="flex-1 rounded-2xl py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: confirmColor }}>
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const ROLES = ['customer', 'reseller', 'api_user', 'support_agent', 'finance_officer', 'admin', 'super_admin'];

function RoleModal({ currentRole, loading, error, onConfirm, onCancel }: {
  currentRole: string; loading: boolean; error: string | null;
  onConfirm: (roleId: string) => void; onCancel: () => void;
}) {
  const [selected, setSelected] = useState(currentRole);
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" style={{ border: `1px solid ${B.border}` }} onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold" style={{ color: B.text }}>Assign role</h3>
        <p className="mb-4 mt-1 text-sm" style={{ color: B.muted }}>Current: <strong>{currentRole}</strong></p>
        <div className="space-y-1.5">
          {ROLES.map(r => (
            <button key={r} onClick={() => setSelected(r)}
              className="flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition"
              style={{ borderColor: selected === r ? B.orange : B.border, background: selected === r ? 'rgba(249,115,22,0.06)' : B.white, color: B.text }}>
              <div className="h-4 w-4 shrink-0 rounded-full border-2" style={{ borderColor: selected === r ? B.orange : B.border, background: selected === r ? B.orange : 'transparent' }} />
              {r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button onClick={onCancel} disabled={loading} className="flex-1 rounded-2xl border py-2.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50" style={{ borderColor: B.border, color: B.text }}>Cancel</button>
          <button onClick={() => onConfirm(selected)} disabled={loading || selected === currentRole}
            className="flex-1 rounded-2xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}>
            {loading ? 'Saving…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ h = 4, w = 'full', rounded = 'xl' }: { h?: number; w?: string; rounded?: string }) {
  return <div className={`animate-pulse rounded-${rounded} w-${w} h-${h}`} style={{ background: B.border }} />;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.userId as string;

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBalance, setShowBalance] = useState(true);

  // Modal state
  type ModalKind = 'freeze' | 'unfreeze' | 'suspend' | 'activate' | null;
  const [modalKind, setModalKind] = useState<ModalKind>(null);
  const [note, setNote] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [roleModal, setRoleModal] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Parallel fetches — user, wallet, transactions
      const [userRes, txnRes] = await Promise.all([
        fetch(`/api/internal/users/${userId}`),
        fetch(`/api/v1/transactions?page=1&pageSize=8`),
      ]);

      const userJson = await userRes.json();
      if (!userJson.success) throw new Error(userJson.error ?? 'Failed to load user');

      const txnJson = txnRes.ok ? await txnRes.json() : { success: false };

      // Wallet comes from the user detail endpoint too — use whatever the API provides
      setData({
        user: userJson.data.user,
        wallet: userJson.data.wallet ?? null,
        recentTransactions: txnJson.success ? (txnJson.data?.transactions ?? []) : [],
        referralCount: userJson.data.referralCount ?? 0,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const confirmAction = async () => {
    if (!note.trim() || !modalKind) return;
    setModalLoading(true);
    setModalError(null);
    try {
      if (modalKind === 'freeze' || modalKind === 'unfreeze') {
        const res = await fetch('/api/internal/wallet/freeze', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, action: modalKind, reason: note }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
      } else {
        const res = await fetch('/api/internal/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, isActive: modalKind === 'activate', reason: note }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
      }
      setModalKind(null);
      setNote('');
      fetchData();
    } catch (e: unknown) {
      setModalError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setModalLoading(false);
    }
  };

  const confirmRole = async (roleId: string) => {
    setRoleLoading(true);
    setRoleError(null);
    try {
      const res = await fetch('/api/internal/roles/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roleId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRoleModal(false);
      fetchData();
    } catch (e: unknown) {
      setRoleError(e instanceof Error ? e.message : 'Failed to assign role');
    } finally {
      setRoleLoading(false);
    }
  };

  // ── Modal configs ────────────────────────────────────────────────────────────
  const user = data?.user;
  const wallet = data?.wallet;

  const modalConfig: Record<string, { title: string; message: string; confirmLabel: string; confirmColor: string }> = {
    freeze: { title: 'Freeze wallet', message: 'The user will be unable to transact until their wallet is unfrozen.', confirmLabel: 'Freeze wallet', confirmColor: '#2563EB' },
    unfreeze: { title: 'Unfreeze wallet', message: 'The wallet will be restored to normal and the user can transact again.', confirmLabel: 'Unfreeze wallet', confirmColor: '#059669' },
    suspend: { title: 'Suspend account', message: 'The user will be locked out of their account until reactivated.', confirmLabel: 'Suspend account', confirmColor: '#DC2626' },
    activate: { title: 'Activate account', message: "The user's account will be fully restored.", confirmLabel: 'Activate account', confirmColor: '#059669' },
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Back */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 animate-pulse rounded-xl" style={{ background: B.border }} />
          <Skeleton h={4} w="32" />
        </div>
        {/* Header skeleton */}
        <div className="rounded-2xl border bg-white p-6" style={{ borderColor: B.border }}>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 animate-pulse rounded-full" style={{ background: B.border }} />
            <div className="space-y-2">
              <Skeleton h={5} w="48" />
              <Skeleton h={3} w="64" />
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl" style={{ background: B.border }} />)}
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4" style={{ color: B.muted }}>
        <AlertTriangle size={32} color="#DC2626" />
        <p className="text-sm font-medium text-red-600">{error ?? 'User not found'}</p>
        <div className="flex gap-3">
          <button onClick={fetchData} className="flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 transition" style={{ borderColor: B.border, color: B.muted }}>
            <RefreshCw size={13} /> Retry
          </button>
          <Link href="/admin/users" className="flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 transition" style={{ borderColor: B.border, color: B.muted }}>
            <ArrowLeft size={13} /> Back
          </Link>
        </div>
      </div>
    );
  }

  const accountStatus = !user.isActive ? 'Suspended' : user.isFrozen ? 'Frozen' : 'Active';
  const accountStatusColor = !user.isActive
    ? { bg: '#FEF2F2', text: '#DC2626', icon: <XCircle size={11} /> }
    : user.isFrozen
    ? { bg: '#EFF6FF', text: '#2563EB', icon: <Lock size={11} /> }
    : { bg: '#ECFDF5', text: '#059669', icon: <CheckCircle size={11} /> };

  return (
    <div className="space-y-6">
      {/* ── Back nav ── */}
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm font-medium transition hover:opacity-70" style={{ color: B.muted }}>
        <ArrowLeft size={15} /> All Users
      </Link>

      {/* ── Profile header ── */}
      <div className="rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: B.border }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Avatar + identity */}
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-black text-white shadow-lg"
              style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}
            >
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black" style={{ color: B.text }}>{user.displayName}</h1>
                <Badge
                  label={accountStatus}
                  bg={accountStatusColor.bg}
                  color={accountStatusColor.text}
                  icon={accountStatusColor.icon}
                />
                <Badge
                  label={`T${user.kycTier} ${kycLabel(user.kycTier)}`}
                  bg={`${kycColor(user.kycTier)}18`}
                  color={kycColor(user.kycTier)}
                  icon={<BadgeCheck size={10} />}
                />
                <Badge
                  label={user.riskLevel}
                  bg={`${riskColor(user.riskLevel)}18`}
                  color={riskColor(user.riskLevel)}
                  icon={<TrendingUp size={10} />}
                />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs" style={{ color: B.faint }}>
                <span className="flex items-center gap-1"><Mail size={11} />{user.email}</span>
                <span className="flex items-center gap-1"><Phone size={11} />{user.phone}</span>
                <span className="flex items-center gap-1"><Calendar size={11} />Joined {formatDate(user.createdAt)}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="flex items-center gap-1 rounded-lg px-2 py-0.5 font-semibold" style={{ background: B.surface, color: B.muted }}>
                  <Shield size={10} />{user.roleId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
                <span className="flex items-center gap-1 rounded-lg px-2 py-0.5 font-semibold" style={{ background: B.surface, color: B.muted }}>
                  <Zap size={10} />{user.subscriptionPlanId}
                </span>
                {user.hasBucket && (
                  <span className="flex items-center gap-1 rounded-lg px-2 py-0.5 font-semibold" style={{ background: 'rgba(34,197,94,0.1)', color: B.green }}>
                    <CircleDot size={10} />Has Bucket
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setRoleModal(true); setRoleError(null); }}
              className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-gray-50"
              style={{ borderColor: B.border, color: B.muted }}
            >
              <UserCog size={13} />Assign Role
            </button>

            {user.isFrozen ? (
              <button onClick={() => { setModalKind('unfreeze'); setNote(''); setModalError(null); }}
                className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-green-50"
                style={{ borderColor: '#BBF7D0', color: '#059669' }}>
                <Unlock size={13} />Unfreeze Wallet
              </button>
            ) : (
              <button onClick={() => { setModalKind('freeze'); setNote(''); setModalError(null); }}
                className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-blue-50"
                style={{ borderColor: '#BFDBFE', color: '#2563EB' }}>
                <Lock size={13} />Freeze Wallet
              </button>
            )}

            {user.isActive ? (
              <button onClick={() => { setModalKind('suspend'); setNote(''); setModalError(null); }}
                className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-red-50"
                style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                <Ban size={13} />Suspend
              </button>
            ) : (
              <button onClick={() => { setModalKind('activate'); setNote(''); setModalError(null); }}
                className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-green-50"
                style={{ borderColor: '#BBF7D0', color: '#059669' }}>
                <UserCheck size={13} />Activate
              </button>
            )}

            <button onClick={fetchData} className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-gray-50" style={{ borderColor: B.border, color: B.muted }}>
              <RefreshCw size={13} />Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Wallet stats strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1 rounded-2xl border bg-white p-4" style={{ borderColor: B.border }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: B.faint }}>Balance</p>
            <button onClick={() => setShowBalance(s => !s)} style={{ color: B.faint }}>
              {showBalance ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
          </div>
          <p className="text-xl font-black leading-tight" style={{ color: B.text }}>
            {wallet ? (showBalance ? formatKobo(wallet.balance) : '₦ ••••') : '—'}
          </p>
          {wallet?.lockedBalance ? (
            <p className="text-xs mt-0.5" style={{ color: '#D97706' }}>{formatKobo(wallet.lockedBalance)} locked</p>
          ) : null}
        </div>
        <Stat label="Total Funded" value={wallet ? formatKobo(wallet.totalFunded) : '—'} />
        <Stat label="Total Spent" value={wallet ? formatKobo(wallet.totalSpent) : '—'} />
        <Stat label="Referrals" value={String(data?.referralCount ?? 0)} sub="Total referred users" />
      </div>

      {/* ── Main 2-col grid ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: 2 cols */}
        <div className="space-y-6 lg:col-span-2">

          {/* Account info */}
          <SectionCard title="Account Details" icon={<User size={14} />}>
            <InfoRow label="UID" value={user.uid} mono copy />
            <InfoRow label="Display Name" value={user.displayName} />
            <InfoRow label="Email" value={user.email} copy />
            <InfoRow label="Phone" value={user.phone} copy />
            <InfoRow label="Role" value={
              <span className="flex items-center gap-1.5">
                <Shield size={11} color={B.orange} />
                {user.roleId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
            } />
            <InfoRow label="KYC Tier" value={
              <span style={{ color: kycColor(user.kycTier), fontWeight: 600 }}>
                T{user.kycTier} — {kycLabel(user.kycTier)}
              </span>
            } />
            <InfoRow label="Risk Level" value={
              <span className="flex items-center gap-1.5 capitalize font-semibold" style={{ color: riskColor(user.riskLevel) }}>
                <ShieldAlert size={11} />{user.riskLevel}
              </span>
            } />
            <InfoRow label="Subscription" value={
              <span className="flex items-center gap-1.5">
                <Zap size={11} color={B.orange} />
                {user.subscriptionPlanId}
                {user.subscriptionExpiresAt && (
                  <span style={{ color: B.faint }}>(expires {formatDate(user.subscriptionExpiresAt)})</span>
                )}
              </span>
            } />
            <InfoRow label="Referral Code" value={user.referralCode} mono copy />
            {user.referredBy && <InfoRow label="Referred By (UID)" value={user.referredBy} mono copy />}
            <InfoRow label="Joined" value={formatDate(user.createdAt, true)} />
            <InfoRow label="Last Updated" value={formatDate(user.updatedAt, true)} />
          </SectionCard>

          {/* Wallet */}
          {wallet && (
            <SectionCard title="Wallet" icon={<Wallet size={14} />}>
              <InfoRow label="Currency" value={wallet.currency} />
              <InfoRow label="Virtual Account" value={wallet.virtualAccountNumber || '—'} mono copy={!!wallet.virtualAccountNumber} />
              <InfoRow label="Bank" value={wallet.virtualAccountBank || '—'} />
              <InfoRow label="Total Withdrawn" value={formatKobo(wallet.totalWithdrawn)} />
              {wallet.lockedBalance > 0 && (
                <InfoRow label="Locked Balance" value={
                  <span style={{ color: '#D97706', fontWeight: 600 }}>{formatKobo(wallet.lockedBalance)}</span>
                } />
              )}
            </SectionCard>
          )}

          {/* Recent transactions */}
          <SectionCard title="Recent Transactions" icon={<CreditCard size={14} />}>
            {data?.recentTransactions.length === 0 ? (
              <p className="text-center text-sm py-8" style={{ color: B.faint }}>No transactions yet</p>
            ) : (
              <div className="space-y-0">
                {data?.recentTransactions.map((txn) => {
                  const sc = statusColor(txn.status);
                  return (
                    <div key={txn.id} className="flex items-center gap-3 py-3 border-b last:border-b-0" style={{ borderColor: B.border }}>
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white text-xs font-bold"
                        style={{ background: txn.type === 'credit' ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.12)', color: txn.type === 'credit' ? '#059669' : B.orange }}
                      >
                        {txn.type === 'credit' ? '+' : '−'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: B.text }}>{categoryLabel(txn.category)}</p>
                        <p className="text-xs truncate" style={{ color: B.faint }}>{txn.reference} · {formatDate(txn.createdAt, true)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold" style={{ color: txn.type === 'credit' ? '#059669' : B.text }}>
                          {txn.type === 'credit' ? '+' : '−'}{formatKobo(txn.amount)}
                        </p>
                        <span className="text-xs rounded-md px-1.5 py-0.5 font-semibold" style={{ background: sc.bg, color: sc.text }}>
                          {txn.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Link
              href={`/admin/transactions?userId=${userId}`}
              className="mt-3 flex items-center justify-center gap-1 text-xs font-semibold transition hover:opacity-70"
              style={{ color: B.orange }}
            >
              View all transactions <ChevronRight size={13} />
            </Link>
          </SectionCard>
        </div>

        {/* Right: 1 col */}
        <div className="space-y-6">
          {/* Spending limits */}
          <SectionCard title="Spending Limits" icon={<BarChart2 size={14} />}>
            <InfoRow label="Daily Limit" value={user.spendingLimits.dailyLimit !== null ? formatKobo(user.spendingLimits.dailyLimit) : 'KYC default'} />
            <InfoRow label="Daily Spent" value={formatKobo(user.spendingLimits.dailySpent)} />
            <InfoRow label="Weekly Limit" value={user.spendingLimits.weeklyLimit !== null ? formatKobo(user.spendingLimits.weeklyLimit) : 'Not set'} />
            <InfoRow label="Weekly Spent" value={formatKobo(user.spendingLimits.weeklySpent)} />
            <InfoRow label="Last Reset" value={user.spendingLimits.lastResetDate || '—'} />

            {/* Daily usage bar */}
            {user.spendingLimits.dailyLimit !== null && user.spendingLimits.dailyLimit > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1" style={{ color: B.faint }}>
                  <span>Daily usage</span>
                  <span>{Math.min(100, Math.round((user.spendingLimits.dailySpent / user.spendingLimits.dailyLimit) * 100))}%</span>
                </div>
                <div className="h-1.5 rounded-full w-full overflow-hidden" style={{ background: B.border }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (user.spendingLimits.dailySpent / user.spendingLimits.dailyLimit) * 100)}%`,
                      background: 'linear-gradient(90deg,#F97316,#EA580C)',
                    }}
                  />
                </div>
              </div>
            )}
          </SectionCard>

          {/* Status flags */}
          <SectionCard title="Account Flags" icon={<Activity size={14} />}>
            {[
              { label: 'Account Active', value: user.isActive },
              { label: 'Wallet Frozen', value: user.isFrozen, inverted: true },
              { label: 'Transaction PIN Set', value: !!user.transactionPin },
              { label: 'Has Bucket', value: user.hasBucket },
              { label: 'Email Notifications', value: user.notifications.email },
              { label: 'SMS Notifications', value: user.notifications.sms },
              { label: 'Push Notifications', value: user.notifications.push },
              { label: 'WhatsApp Alerts', value: user.notifications.whatsapp },
            ].map(({ label, value, inverted }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b last:border-b-0 text-sm" style={{ borderColor: B.border }}>
                <span style={{ color: B.muted }}>{label}</span>
                {(inverted ? !value : value) ? (
                  <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#059669' }}>
                    <CheckCircle size={12} />{inverted ? 'No' : 'Yes'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: B.faint }}>
                    <XCircle size={12} />{inverted ? 'Yes' : 'No'}
                  </span>
                )}
              </div>
            ))}
          </SectionCard>

          {/* Quick links */}
          <SectionCard title="Quick Links" icon={<ExternalLink size={14} />}>
            {[
              { label: 'All transactions', href: `/admin/transactions?userId=${userId}`, icon: <CreditCard size={14} /> },
              { label: 'Commissions', href: `/admin/commissions?userId=${userId}`, icon: <BarChart2 size={14} /> },
              { label: 'Disputes', href: `/admin/disputes?userId=${userId}`, icon: <AlertTriangle size={14} /> },
              { label: 'Support tickets', href: `/admin/support?userId=${userId}`, icon: <FileText size={14} /> },
              { label: 'Audit log', href: `/admin/audit-log?userId=${userId}`, icon: <Clock size={14} /> },
            ].map(({ label, href, icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-orange-50 group"
                style={{ color: B.muted }}
              >
                <span style={{ color: B.faint }} className="group-hover:text-orange-500 transition">{icon}</span>
                {label}
                <ChevronRight size={13} className="ml-auto" style={{ color: B.faint }} />
              </Link>
            ))}
          </SectionCard>

          {/* Metadata */}
          <SectionCard title="System Info" icon={<Settings size={14} />}>
            <InfoRow label="User ID" value={user.uid} mono copy />
            <InfoRow label="Reseller Level" value={String(user.resellerLevel)} />
            {user.referredBy && <InfoRow label="Referred By" value={user.referredBy} mono />}
          </SectionCard>
        </div>
      </div>

      {/* ── Modals ── */}
      {modalKind && (
        <ConfirmModal
          {...modalConfig[modalKind]}
          loading={modalLoading}
          error={modalError}
          note={note}
          onNote={setNote}
          onConfirm={confirmAction}
          onCancel={() => { setModalKind(null); setNote(''); }}
        />
      )}

      {roleModal && (
        <RoleModal
          currentRole={user.roleId}
          loading={roleLoading}
          error={roleError}
          onConfirm={confirmRole}
          onCancel={() => { setRoleModal(false); setRoleError(null); }}
        />
      )}
    </div>
  );
}