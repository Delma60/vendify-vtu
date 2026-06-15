// vtu-web/app/(dashboard)/wallet/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Copy,
  Send,
  PiggyBank,
  Landmark,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShieldCheck,
  Plus,
  Trash2,
  ExternalLink,
  Lock,
  TrendingUp,
  TrendingDown,
  History,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const B = {
  orange: "#F97316",
  orangeDark: "#EA580C",
  green: "#22C55E",
  greenDark: "#16A34A",
  text: "#111827",
  textMuted: "#6B7280",
  textFaint: "#9CA3AF",
  border: "#E5E7EB",
  surface: "#F9FAFB",
  surfaceWarm: "#FFFBF5",
  white: "#FFFFFF",
  red: "#DC2626",
  redSurface: "#FEF2F2",
  redBorder: "#FECACA",
  greenSurface: "#F0FDF4",
  greenBorder: "#BBF7D0",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "overview" | "fund" | "transfer" | "withdraw" | "security";
type PaymentMethod = "card" | "bank_transfer" | "ussd";

interface WalletBalance {
  balance: number;
  currency: string;
  totalFunded: number;
  totalSpent: number;
  totalWithdrawn: number;
  lockedBalance: number;
  virtualAccountNumber: string;
  virtualAccountBank: string;
}

interface Bank { id: number; code: string; name: string; }
interface BankAccount {
  id: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  isVerified: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (k: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(k / 100);

const inputCls = `
  w-full rounded-xl border px-4 py-3 text-sm outline-none transition
  border-[#E5E7EB] bg-white text-[#111827] placeholder-[#9CA3AF]
  focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20
`.trim();

// ─── Result Banner ────────────────────────────────────────────────────────────
function ResultBanner({ result }: { result: { success: boolean; message: string } }) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
      style={result.success
        ? { background: B.greenSurface, borderColor: B.greenBorder, color: B.greenDark }
        : { background: B.redSurface, borderColor: B.redBorder, color: B.red }
      }
    >
      {result.success
        ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
        : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      }
      <span>{result.message}</span>
    </div>
  );
}

// ─── Primary Button ───────────────────────────────────────────────────────────
function PrimaryBtn({
  onClick, disabled, loading, children, fullWidth = true
}: {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${fullWidth ? "w-full" : ""}`}
      style={{ background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`, boxShadow: "0 4px 14px rgba(249,115,22,0.25)" }}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

// ─── OVERVIEW PANEL ───────────────────────────────────────────────────────────
function OverviewPanel({ wallet, loading, onRefresh }: {
  wallet: WalletBalance | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);

  const copyAccount = async () => {
    if (!wallet?.virtualAccountNumber) return;
    await navigator.clipboard.writeText(wallet.virtualAccountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !wallet) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: B.orange }} />
      </div>
    );
  }
  if (!wallet) return null;

  return (
    <div className="space-y-5">
      {/* Balance Hero */}
      <div
        className="relative overflow-hidden rounded-2xl p-6"
        style={{ background: `linear-gradient(135deg, ${B.orange} 0%, ${B.orangeDark} 100%)` }}
      >
        {/* Decorative rings */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />

        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-white/80">
              <Wallet className="h-4 w-4" />
              <span className="text-xs font-medium tracking-wide">Available Balance</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setBalanceVisible(v => !v)}
                className="rounded-lg p-1.5 text-white/70 hover:text-white transition"
              >
                {balanceVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button
                onClick={onRefresh}
                className="rounded-lg p-1.5 text-white/70 hover:text-white transition"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <p className="text-4xl font-extrabold text-white tracking-tight">
            {balanceVisible ? fmt(wallet.balance) : "₦ ••••••"}
          </p>

          {wallet.lockedBalance > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-white/70">
              <Lock className="h-3 w-3" />
              {fmt(wallet.lockedBalance)} held for pending disputes
            </p>
          )}

          {/* Virtual account chip */}
          {wallet.virtualAccountNumber && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                  <Landmark className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-white/70">Fund by bank transfer</p>
                  <p className="text-sm font-bold text-white">
                    {wallet.virtualAccountNumber}
                    <span className="font-normal text-white/70"> · {wallet.virtualAccountBank}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={copyAccount}
                className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/30 transition"
              >
                {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Total funded", value: fmt(wallet.totalFunded), icon: TrendingUp, color: B.green },
          { label: "Total spent", value: fmt(wallet.totalSpent), icon: TrendingDown, color: B.orange },
          { label: "Total withdrawn", value: fmt(wallet.totalWithdrawn), icon: ArrowUpFromLine, color: B.textMuted },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-2xl border p-5"
            style={{ borderColor: B.border, background: B.surface }}
          >
            <Icon className="h-5 w-5" style={{ color }} />
            <p className="mt-3 text-lg font-bold" style={{ color: B.text }}>{value}</p>
            <p className="mt-0.5 text-xs" style={{ color: B.textFaint }}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FUND PANEL ───────────────────────────────────────────────────────────────
function FundPanel({ wallet }: { wallet: WalletBalance | null }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const METHODS: { value: PaymentMethod; label: string }[] = [
    { value: "card", label: "Card" },
    { value: "bank_transfer", label: "Bank Transfer" },
    { value: "ussd", label: "USSD" },
  ];

  const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 20000];

  const submit = async () => {
    if (!amount || Number(amount) < 100) return;
    setLoading(true);
    setResult(null);
    setPaymentLink(null);
    try {
      const res = await fetch("/api/v1/wallet/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Math.round(Number(amount) * 100), paymentMethod: method }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to initiate funding");
      setPaymentLink(data.data.paymentLink);
      setResult({ success: true, message: "Payment initiated. Complete it via the link below." });
    } catch (e: any) {
      setResult({ success: false, message: e.message });
    } finally {
      setLoading(false);
    }
  };

  const copyAccount = async () => {
    if (!wallet?.virtualAccountNumber) return;
    await navigator.clipboard.writeText(wallet.virtualAccountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {result && <ResultBanner result={result} />}

      {paymentLink && (
        <a
          href={paymentLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})` }}
        >
          Continue to payment <ExternalLink className="h-4 w-4" />
        </a>
      )}

      {/* Card / transfer / USSD */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: B.border }}>
        <h3 className="text-sm font-semibold" style={{ color: B.text }}>
          Pay with card, transfer, or USSD
        </h3>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: B.textMuted }}>Amount (₦)</label>
          <input
            type="number"
            min="100"
            className={inputCls}
            placeholder="1,000"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map(a => (
              <button
                key={a}
                onClick={() => setAmount(String(a))}
                className="rounded-lg border px-3 py-1 text-xs font-medium transition hover:border-[#F97316] hover:text-[#F97316]"
                style={{ borderColor: B.border, color: B.textMuted }}
              >
                ₦{a.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: B.textMuted }}>Payment method</label>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map(m => (
              <button
                key={m.value}
                onClick={() => setMethod(m.value)}
                className="rounded-xl border px-3 py-2.5 text-sm font-medium transition"
                style={method === m.value
                  ? { borderColor: B.orange, background: `${B.orange}15`, color: B.orange }
                  : { borderColor: B.border, color: B.textMuted }
                }
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <PrimaryBtn
          onClick={submit}
          loading={loading}
          disabled={!amount || Number(amount) < 100}
        >
          {loading ? "Initiating…" : "Proceed to pay"}
        </PrimaryBtn>
      </div>

      {/* Direct transfer */}
      {wallet?.virtualAccountNumber && (
        <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: B.border, background: B.surfaceWarm }}>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: B.text }}>Or transfer directly</h3>
            <p className="mt-0.5 text-xs" style={{ color: B.textFaint }}>
              Send any amount to this account and your wallet is credited within seconds.
            </p>
          </div>
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
            style={{ borderColor: B.border, background: B.white }}
          >
            <div>
              <p className="text-lg font-bold tracking-wide" style={{ color: B.text }}>
                {wallet.virtualAccountNumber}
              </p>
              <p className="text-xs" style={{ color: B.textFaint }}>{wallet.virtualAccountBank}</p>
            </div>
            <button
              onClick={copyAccount}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition"
              style={{ borderColor: B.border, color: B.textMuted }}
            >
              {copied ? <CheckCircle2 className="h-3.5 w-3.5" style={{ color: B.green }} /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TRANSFER PANEL ───────────────────────────────────────────────────────────
function TransferPanel() {
  const [form, setForm] = useState({ recipientIdentifier: "", amount: "", narration: "", pin: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const submit = async () => {
    if (!form.recipientIdentifier || !form.amount || form.pin.length !== 4) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/v1/wallet/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientIdentifier: form.recipientIdentifier,
          amount: Math.round(Number(form.amount) * 100),
          narration: form.narration || undefined,
          transactionPin: form.pin,
          idempotencyKey: `transfer-${Date.now()}-${form.recipientIdentifier}`,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Transfer failed");
      setResult({ success: true, message: `${fmt(Math.round(Number(form.amount) * 100))} sent to ${data.data.recipientName}.` });
      setForm({ recipientIdentifier: "", amount: "", narration: "", pin: "" });
    } catch (e: any) {
      setResult({ success: false, message: e.message });
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: "recipientIdentifier", label: "Recipient", placeholder: "Email, phone, or referral code", type: "text" },
    { key: "amount", label: "Amount (₦)", placeholder: "1,000", type: "number" },
    { key: "narration", label: "Note (optional)", placeholder: "What's this for?", type: "text" },
    { key: "pin", label: "Transaction PIN", placeholder: "••••", type: "password" },
  ];

  return (
    <div className="space-y-4">
      {result && <ResultBanner result={result} />}
      {fields.map(f => (
        <div key={f.key}>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: B.textMuted }}>{f.label}</label>
          <input
            type={f.type}
            maxLength={f.key === "pin" ? 4 : undefined}
            className={inputCls}
            placeholder={f.placeholder}
            value={(form as any)[f.key]}
            onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
          />
        </div>
      ))}
      <PrimaryBtn
        onClick={submit}
        loading={loading}
        disabled={!form.recipientIdentifier || !form.amount || form.pin.length !== 4}
      >
        {loading ? "Sending…" : "Send money"}
      </PrimaryBtn>
    </div>
  );
}

// ─── WITHDRAW PANEL ───────────────────────────────────────────────────────────
function WithdrawPanel({ wallet }: { wallet: WalletBalance | null }) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ accountNumber: "", bankCode: "" });
  const [addingAccount, setAddingAccount] = useState(false);
  const [addResult, setAddResult] = useState<{ success: boolean; message: string } | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [form, setForm] = useState({ amount: "", narration: "", pin: "" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch("/api/v1/wallet/bank-accounts");
      const data = await res.json();
      if (data.success) {
        setAccounts(data.data.accounts ?? []);
        if (data.data.accounts?.length && !selectedAccountId) {
          setSelectedAccountId(data.data.accounts[0].id);
        }
      }
    } catch { } finally { setLoadingAccounts(false); }
  }, [selectedAccountId]);

  const loadBanks = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/wallet/banks");
      const data = await res.json();
      if (data.success) setBanks(data.data.banks ?? []);
    } catch { }
  }, []);

  useEffect(() => { loadAccounts(); loadBanks(); }, [loadAccounts, loadBanks]);

  const addAccount = async () => {
    if (!newAccount.accountNumber || newAccount.accountNumber.length !== 10 || !newAccount.bankCode) return;
    setAddingAccount(true);
    setAddResult(null);
    try {
      const bank = banks.find(b => b.code === newAccount.bankCode);
      const res = await fetch("/api/v1/wallet/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNumber: newAccount.accountNumber, bankCode: newAccount.bankCode, bankName: bank?.name ?? "" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Could not verify account");
      setAddResult({ success: true, message: `Saved ${data.data.accountName} (${data.data.bankName}).` });
      setNewAccount({ accountNumber: "", bankCode: "" });
      setShowAddAccount(false);
      setSelectedAccountId(data.data.id);
      loadAccounts();
    } catch (e: any) {
      setAddResult({ success: false, message: e.message });
    } finally { setAddingAccount(false); }
  };

  const removeAccount = async (id: string) => {
    setRemovingId(id);
    try {
      await fetch("/api/v1/wallet/bank-accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: id }),
      });
      if (selectedAccountId === id) setSelectedAccountId(null);
      loadAccounts();
    } finally { setRemovingId(null); }
  };

  const submitWithdrawal = async () => {
    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account || !form.amount || form.pin.length !== 4) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/v1/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(Number(form.amount) * 100),
          accountNumber: account.accountNumber,
          bankCode: account.bankCode,
          accountName: account.accountName,
          transactionPin: form.pin,
          narration: form.narration || undefined,
          idempotencyKey: `withdraw-${Date.now()}-${account.id}`,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Withdrawal failed");
      setResult({ success: true, message: data.data.message ?? "Withdrawal initiated." });
      setForm({ amount: "", narration: "", pin: "" });
    } catch (e: any) {
      setResult({ success: false, message: e.message });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-5">
      {result && <ResultBanner result={result} />}

      {/* Bank account selector */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium" style={{ color: B.textMuted }}>Withdraw to</label>
          <button
            onClick={() => { setShowAddAccount(s => !s); setAddResult(null); }}
            className="flex items-center gap-1 text-xs font-medium transition"
            style={{ color: B.orange }}
          >
            <Plus className="h-3.5 w-3.5" /> Add account
          </button>
        </div>

        {loadingAccounts ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: B.orange }} />
          </div>
        ) : accounts.length === 0 && !showAddAccount ? (
          <div
            className="rounded-xl border-2 border-dashed py-10 text-center"
            style={{ borderColor: B.border }}
          >
            <Landmark className="mx-auto h-7 w-7 mb-2" style={{ color: B.textFaint }} />
            <p className="text-sm" style={{ color: B.textMuted }}>No bank accounts saved yet.</p>
            <button
              onClick={() => setShowAddAccount(true)}
              className="mt-3 rounded-xl border px-4 py-2 text-xs font-medium transition hover:border-[#F97316] hover:text-[#F97316]"
              style={{ borderColor: B.border, color: B.textMuted }}
            >
              Add a bank account
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map(acc => (
              <label
                key={acc.id}
                className="flex items-center justify-between gap-3 rounded-xl border p-3.5 cursor-pointer transition"
                style={selectedAccountId === acc.id
                  ? { borderColor: B.orange, background: `${B.orange}08` }
                  : { borderColor: B.border, background: B.white }
                }
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="bankAccount"
                    checked={selectedAccountId === acc.id}
                    onChange={() => setSelectedAccountId(acc.id)}
                    className="accent-[#F97316]"
                  />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: B.text }}>{acc.accountName}</p>
                    <p className="text-xs" style={{ color: B.textFaint }}>{acc.bankName} · {acc.accountNumber}</p>
                  </div>
                </div>
                <button
                  onClick={e => { e.preventDefault(); removeAccount(acc.id); }}
                  disabled={removingId === acc.id}
                  className="text-gray-400 hover:text-red-500 transition disabled:opacity-40"
                >
                  {removingId === acc.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />
                  }
                </button>
              </label>
            ))}
          </div>
        )}

        {/* Add account form */}
        {showAddAccount && (
          <div className="mt-3 rounded-xl border p-4 space-y-3" style={{ borderColor: B.border, background: B.surface }}>
            {addResult && <ResultBanner result={addResult} />}
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: B.textMuted }}>Bank</label>
              <select
                className={inputCls}
                value={newAccount.bankCode}
                onChange={e => setNewAccount(a => ({ ...a, bankCode: e.target.value }))}
              >
                <option value="">Select bank</option>
                {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: B.textMuted }}>Account number</label>
              <input
                type="text"
                maxLength={10}
                className={inputCls}
                placeholder="0123456789"
                value={newAccount.accountNumber}
                onChange={e => setNewAccount(a => ({ ...a, accountNumber: e.target.value.replace(/[^\d]/g, "") }))}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddAccount(false)}
                className="flex-1 rounded-xl border py-2.5 text-sm font-medium transition hover:bg-gray-50"
                style={{ borderColor: B.border, color: B.textMuted }}
              >
                Cancel
              </button>
              <PrimaryBtn
                onClick={addAccount}
                loading={addingAccount}
                disabled={newAccount.accountNumber.length !== 10 || !newAccount.bankCode}
                fullWidth={false}
              >
                <span className="flex-1">Verify &amp; save</span>
              </PrimaryBtn>
            </div>
          </div>
        )}
      </div>

      {/* Withdrawal form */}
      <div>
        <label className="mb-1.5 block text-xs font-medium" style={{ color: B.textMuted }}>Amount (₦)</label>
        <input
          type="number"
          min="500"
          className={inputCls}
          placeholder="500"
          value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
        />
        {wallet && (
          <p className="mt-1.5 text-xs" style={{ color: B.textFaint }}>
            Available: {fmt(wallet.balance)}
          </p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium" style={{ color: B.textMuted }}>Note (optional)</label>
        <input
          type="text"
          maxLength={50}
          className={inputCls}
          placeholder="Withdrawal note"
          value={form.narration}
          onChange={e => setForm(f => ({ ...f, narration: e.target.value }))}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium" style={{ color: B.textMuted }}>Transaction PIN</label>
        <input
          type="password"
          maxLength={4}
          className={inputCls}
          placeholder="••••"
          value={form.pin}
          onChange={e => setForm(f => ({ ...f, pin: e.target.value }))}
        />
      </div>

      <PrimaryBtn
        onClick={submitWithdrawal}
        loading={submitting}
        disabled={!selectedAccountId || !form.amount || form.pin.length !== 4}
      >
        {submitting ? "Processing…" : "Withdraw"}
      </PrimaryBtn>
    </div>
  );
}

// ─── SECURITY PANEL ───────────────────────────────────────────────────────────
function SecurityPanel() {
  const [setForm, setSetForm] = useState({ pin: "", confirmPin: "" });
  const [setting, setSetting] = useState(false);
  const [setResult, setSetResult] = useState<{ success: boolean; message: string } | null>(null);

  const [changeForm, setChangeForm] = useState({ currentPin: "", newPin: "", confirmNewPin: "" });
  const [changing, setChanging] = useState(false);
  const [changeResult, setChangeResult] = useState<{ success: boolean; message: string } | null>(null);

  const submitSetPin = async () => {
    if (setForm.pin.length !== 4 || setForm.pin !== setForm.confirmPin) return;
    setSetting(true);
    setSetResult(null);
    try {
      const res = await fetch("/api/v1/wallet/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: setForm.pin, confirmPin: setForm.confirmPin }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to set PIN");
      setSetResult({ success: true, message: "Transaction PIN set successfully." });
      setSetForm({ pin: "", confirmPin: "" });
    } catch (e: any) {
      setSetResult({ success: false, message: e.message });
    } finally { setSetting(false); }
  };

  const submitChangePin = async () => {
    if (changeForm.newPin.length !== 4 || changeForm.newPin !== changeForm.confirmNewPin) return;
    setChanging(true);
    setChangeResult(null);
    try {
      const res = await fetch("/api/v1/wallet/pin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin: changeForm.currentPin, newPin: changeForm.newPin, confirmNewPin: changeForm.confirmNewPin }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to change PIN");
      setChangeResult({ success: true, message: "Transaction PIN changed successfully." });
      setChangeForm({ currentPin: "", newPin: "", confirmNewPin: "" });
    } catch (e: any) {
      setChangeResult({ success: false, message: e.message });
    } finally { setChanging(false); }
  };

  return (
    <div className="space-y-5">
      {/* Set PIN */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: B.border }}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${B.green}15` }}>
            <ShieldCheck className="h-4.5 w-4.5" style={{ color: B.greenDark }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: B.text }}>Set transaction PIN</h3>
            <p className="text-xs" style={{ color: B.textFaint }}>Required for all purchases, transfers, and withdrawals.</p>
          </div>
        </div>
        {setResult && <ResultBanner result={setResult} />}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: B.textMuted }}>New PIN</label>
            <input type="password" maxLength={4} className={inputCls} placeholder="••••"
              value={setForm.pin}
              onChange={e => setSetForm(f => ({ ...f, pin: e.target.value.replace(/[^\d]/g, "") }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: B.textMuted }}>Confirm PIN</label>
            <input type="password" maxLength={4} className={inputCls} placeholder="••••"
              value={setForm.confirmPin}
              onChange={e => setSetForm(f => ({ ...f, confirmPin: e.target.value.replace(/[^\d]/g, "") }))}
            />
          </div>
        </div>
        <PrimaryBtn
          onClick={submitSetPin}
          loading={setting}
          disabled={setForm.pin.length !== 4 || setForm.pin !== setForm.confirmPin}
        >
          Set PIN
        </PrimaryBtn>
      </div>

      {/* Change PIN */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ borderColor: B.border }}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${B.orange}15` }}>
            <Lock className="h-4 w-4" style={{ color: B.orange }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: B.text }}>Change transaction PIN</h3>
            <p className="text-xs" style={{ color: B.textFaint }}>You'll need your current PIN to do this.</p>
          </div>
        </div>
        {changeResult && <ResultBanner result={changeResult} />}
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: B.textMuted }}>Current PIN</label>
          <input type="password" maxLength={4} className={inputCls} placeholder="••••"
            value={changeForm.currentPin}
            onChange={e => setChangeForm(f => ({ ...f, currentPin: e.target.value.replace(/[^\d]/g, "") }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: B.textMuted }}>New PIN</label>
            <input type="password" maxLength={4} className={inputCls} placeholder="••••"
              value={changeForm.newPin}
              onChange={e => setChangeForm(f => ({ ...f, newPin: e.target.value.replace(/[^\d]/g, "") }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: B.textMuted }}>Confirm new PIN</label>
            <input type="password" maxLength={4} className={inputCls} placeholder="••••"
              value={changeForm.confirmNewPin}
              onChange={e => setChangeForm(f => ({ ...f, confirmNewPin: e.target.value.replace(/[^\d]/g, "") }))}
            />
          </div>
        </div>
        <PrimaryBtn
          onClick={submitChangePin}
          loading={changing}
          disabled={changeForm.currentPin.length !== 4 || changeForm.newPin.length !== 4 || changeForm.newPin !== changeForm.confirmNewPin}
        >
          Change PIN
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function WalletPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/balance");
      const data = await res.json();
      if (data.success) setWallet(data.data);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadWallet(); }, [loadWallet]);

  const tabs: { value: Tab; label: string; icon: React.ReactNode }[] = [
    { value: "overview", label: "Overview", icon: <Wallet className="h-4 w-4" /> },
    { value: "fund", label: "Fund", icon: <PiggyBank className="h-4 w-4" /> },
    { value: "transfer", label: "Transfer", icon: <Send className="h-4 w-4" /> },
    { value: "withdraw", label: "Withdraw", icon: <ArrowDownToLine className="h-4 w-4" /> },
    { value: "security", label: "Security", icon: <ShieldCheck className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: B.text }}>Wallet</h1>
        <p className="mt-0.5 text-sm" style={{ color: B.textMuted }}>
          Fund, send, withdraw, and manage your transaction PIN.
        </p>
      </div>

      {/* Tab nav */}
      <div
        className="flex gap-1 overflow-x-auto rounded-xl border p-1"
        style={{ borderColor: B.border, background: B.surface }}
      >
        {tabs.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition"
            style={tab === t.value
              ? { background: B.white, color: B.orange, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
              : { color: B.textMuted }
            }
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-2xl border p-6" style={{ borderColor: B.border, background: B.white }}>
        {tab === "overview" && <OverviewPanel wallet={wallet} loading={loading} onRefresh={loadWallet} />}
        {tab === "fund" && <FundPanel wallet={wallet} />}
        {tab === "transfer" && <TransferPanel />}
        {tab === "withdraw" && <WithdrawPanel wallet={wallet} />}
        {tab === "security" && <SecurityPanel />}
      </div>

      {/* Footer link */}
      <div className="flex items-center justify-center gap-1.5 text-xs" style={{ color: B.textFaint }}>
        <History className="h-3.5 w-3.5" />
        <a href="/transactions" className="transition hover:text-[#F97316]">
          View full transaction history
        </a>
      </div>
    </div>
  );
}