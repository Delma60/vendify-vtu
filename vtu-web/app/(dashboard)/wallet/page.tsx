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
} from "lucide-react";

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

interface Bank {
  id: number;
  code: string;
  name: string;
}

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
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    k / 100,
  );

const inputCls =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition";
const selectCls = inputCls;

// ─── Result banner ─────────────────────────────────────────────────────────────

function ResultBanner({
  result,
}: {
  result: { success: boolean; message: string };
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
        result.success
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          : "border-red-500/20 bg-red-500/10 text-red-400"
      }`}
    >
      {result.success ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      )}
      <span>{result.message}</span>
    </div>
  );
}

// ─── OVERVIEW PANEL ─────────────────────────────────────────────────────────────

function OverviewPanel({
  wallet,
  loading,
  onRefresh,
}: {
  wallet: WalletBalance | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyAccount = async () => {
    if (!wallet?.virtualAccountNumber) return;
    await navigator.clipboard.writeText(wallet.virtualAccountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !wallet) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="h-7 w-7 animate-spin text-indigo-400" />
      </div>
    );
  }
  if (!wallet) return null;

  return (
    <div className="space-y-5">
      {/* Balance hero */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400">
            <Wallet className="h-4 w-4" />
            <span className="text-xs">Available balance</span>
          </div>
          <button
            onClick={onRefresh}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <p className="mt-2 text-4xl font-extrabold tracking-tight text-white">
          {fmt(wallet.balance)}
        </p>
        {wallet.lockedBalance > 0 && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-400">
            <Lock className="h-3 w-3" /> {fmt(wallet.lockedBalance)} locked
            (pending disputes)
          </p>
        )}

        {/* Virtual account */}
        {wallet.virtualAccountNumber && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
                <Landmark className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">
                  Fund instantly via bank transfer
                </p>
                <p className="text-sm font-bold tracking-wide text-white">
                  {wallet.virtualAccountNumber}{" "}
                  <span className="font-medium text-slate-400">
                    · {wallet.virtualAccountBank}
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={copyAccount}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              {copied ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {/* Lifetime stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            label: "Total funded",
            value: fmt(wallet.totalFunded),
            icon: TrendingUp,
            color: "text-emerald-400",
          },
          {
            label: "Total spent",
            value: fmt(wallet.totalSpent),
            icon: TrendingDown,
            color: "text-orange-400",
          },
          {
            label: "Total withdrawn",
            value: fmt(wallet.totalWithdrawn),
            icon: ArrowUpFromLine,
            color: "text-indigo-400",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5"
          >
            <Icon className={`h-5 w-5 ${color}`} />
            <p className="mt-3 text-lg font-bold text-white">{value}</p>
            <p className="mt-0.5 text-xs text-slate-400">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FUND PANEL ─────────────────────────────────────────────────────────────────

function FundPanel({ wallet }: { wallet: WalletBalance | null }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const METHODS: { value: PaymentMethod; label: string }[] = [
    { value: "card", label: "Card" },
    { value: "bank_transfer", label: "Bank Transfer" },
    { value: "ussd", label: "USSD" },
  ];

  const submit = async () => {
    if (!amount || Number(amount) < 100) return;
    setLoading(true);
    setResult(null);
    setPaymentLink(null);
    try {
      const res = await fetch("/api/v1/wallet/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(Number(amount) * 100),
          paymentMethod: method,
        }),
      });
      const data = await res.json();
      if (!data.success)
        throw new Error(data.error ?? "Failed to initiate funding");
      setPaymentLink(data.data.paymentLink);
      setResult({
        success: true,
        message: "Payment initiated. Complete it via the link below.",
      });
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
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Continue to payment <ExternalLink className="h-4 w-4" />
        </a>
      )}

      {/* Card / bank / ussd form */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200">
          Pay with card, transfer, or USSD
        </h3>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">
            Amount (₦)
          </label>
          <input
            type="number"
            min="100"
            className={inputCls}
            placeholder="1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {[500, 1000, 2000, 5000, 10000, 20000].map((a) => (
              <button
                key={a}
                onClick={() => setAmount(String(a))}
                className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                ₦{a.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">
            Payment method
          </label>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMethod(m.value)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${method === m.value ? "border-indigo-500 bg-indigo-500/15 text-indigo-400" : "border-slate-700 text-slate-400 hover:border-slate-600"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={submit}
          disabled={loading || !amount || Number(amount) < 100}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
          {loading ? "Initiating..." : "Proceed to pay"}
        </button>
      </div>

      {/* Virtual account funding */}
      {wallet?.virtualAccountNumber && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5">
          <h3 className="text-sm font-semibold text-slate-200">
            Or transfer directly
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Send any amount to the account below and your wallet is credited
            within seconds.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
            <div>
              <p className="text-lg font-bold tracking-wide text-white">
                {wallet.virtualAccountNumber}
              </p>
              <p className="text-xs text-slate-400">
                {wallet.virtualAccountBank}
              </p>
            </div>
            <button
              onClick={copyAccount}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              {copied ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TRANSFER PANEL ─────────────────────────────────────────────────────────────

function TransferPanel() {
  const [form, setForm] = useState({
    recipientIdentifier: "",
    amount: "",
    narration: "",
    pin: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const submit = async () => {
    if (!form.recipientIdentifier || !form.amount || form.pin.length !== 4)
      return;
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
      setResult({
        success: true,
        message: `${fmt(Math.round(Number(form.amount) * 100))} sent to ${data.data.recipientName}.`,
      });
      setForm({ recipientIdentifier: "", amount: "", narration: "", pin: "" });
    } catch (e: any) {
      setResult({ success: false, message: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {result && <ResultBanner result={result} />}

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">
          Recipient (email, phone, or referral code)
        </label>
        <input
          type="text"
          className={inputCls}
          placeholder="user@email.com or 080xxxxxxxx"
          value={form.recipientIdentifier}
          onChange={(e) =>
            setForm((f) => ({ ...f, recipientIdentifier: e.target.value }))
          }
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">
          Amount (₦)
        </label>
        <input
          type="number"
          min="100"
          className={inputCls}
          placeholder="1000"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">
          Note (optional)
        </label>
        <input
          type="text"
          maxLength={100}
          className={inputCls}
          placeholder="What's this for?"
          value={form.narration}
          onChange={(e) =>
            setForm((f) => ({ ...f, narration: e.target.value }))
          }
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">
          Transaction PIN
        </label>
        <input
          type="password"
          maxLength={4}
          className={inputCls}
          placeholder="••••"
          value={form.pin}
          onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))}
        />
      </div>

      <button
        onClick={submit}
        disabled={
          loading ||
          !form.recipientIdentifier ||
          !form.amount ||
          form.pin.length !== 4
        }
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
        {loading ? "Sending..." : "Send money"}
      </button>
    </div>
  );
}

// ─── WITHDRAW PANEL ─────────────────────────────────────────────────────────────

function WithdrawPanel({ wallet }: { wallet: WalletBalance | null }) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  );

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({
    accountNumber: "",
    bankCode: "",
  });
  const [addingAccount, setAddingAccount] = useState(false);
  const [addResult, setAddResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [form, setForm] = useState({ amount: "", narration: "", pin: "" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

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
    } catch {
      /* ignore */
    } finally {
      setLoadingAccounts(false);
    }
  }, [selectedAccountId]);

  const loadBanks = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/wallet/banks");
      const data = await res.json();
      if (data.success) setBanks(data.data.banks ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadAccounts();
    loadBanks();
  }, [loadAccounts, loadBanks]);

  const addAccount = async () => {
    if (
      !newAccount.accountNumber ||
      newAccount.accountNumber.length !== 10 ||
      !newAccount.bankCode
    )
      return;
    setAddingAccount(true);
    setAddResult(null);
    try {
      const bank = banks.find((b) => b.code === newAccount.bankCode);
      const res = await fetch("/api/v1/wallet/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber: newAccount.accountNumber,
          bankCode: newAccount.bankCode,
          bankName: bank?.name ?? "",
        }),
      });
      const data = await res.json();
      if (!data.success)
        throw new Error(data.error ?? "Could not verify account");
      setAddResult({
        success: true,
        message: `Saved ${data.data.accountName} (${data.data.bankName}).`,
      });
      setNewAccount({ accountNumber: "", bankCode: "" });
      setShowAddAccount(false);
      setSelectedAccountId(data.data.id);
      loadAccounts();
    } catch (e: any) {
      setAddResult({ success: false, message: e.message });
    } finally {
      setAddingAccount(false);
    }
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
    } finally {
      setRemovingId(null);
    }
  };

  const submitWithdrawal = async () => {
    const account = accounts.find((a) => a.id === selectedAccountId);
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
      setResult({
        success: true,
        message: data.data.message ?? "Withdrawal initiated.",
      });
      setForm({ amount: "", narration: "", pin: "" });
    } catch (e: any) {
      setResult({ success: false, message: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {result && <ResultBanner result={result} />}

      {/* Saved accounts */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-slate-400">
            Withdraw to
          </label>
          <button
            onClick={() => {
              setShowAddAccount((s) => !s);
              setAddResult(null);
            }}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300"
          >
            <Plus className="h-3.5 w-3.5" /> Add account
          </button>
        </div>

        {loadingAccounts ? (
          <div className="flex justify-center py-6">
            <RefreshCw className="h-5 w-5 animate-spin text-indigo-400" />
          </div>
        ) : accounts.length === 0 && !showAddAccount ? (
          <div className="rounded-xl border border-dashed border-slate-700 py-8 text-center">
            <Landmark className="mx-auto h-7 w-7 text-slate-600" />
            <p className="mt-2 text-sm text-slate-400">
              No bank accounts saved yet.
            </p>
            <button
              onClick={() => setShowAddAccount(true)}
              className="mt-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-xs text-indigo-400 hover:bg-indigo-500/20"
            >
              Add a bank account
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((acc) => (
              <label
                key={acc.id}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 cursor-pointer transition ${selectedAccountId === acc.id ? "border-indigo-500 bg-indigo-500/10" : "border-slate-800 bg-slate-900/30 hover:border-slate-700"}`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="bankAccount"
                    checked={selectedAccountId === acc.id}
                    onChange={() => setSelectedAccountId(acc.id)}
                    className="accent-indigo-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">
                      {acc.accountName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {acc.bankName} · {acc.accountNumber}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    removeAccount(acc.id);
                  }}
                  disabled={removingId === acc.id}
                  className="flex items-center justify-center text-slate-500 hover:text-red-400 disabled:opacity-40"
                >
                  {removingId === acc.id ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </label>
            ))}
          </div>
        )}

        {/* Add account form */}
        {showAddAccount && (
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-3">
            {addResult && <ResultBanner result={addResult} />}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Bank
              </label>
              <select
                className={selectCls}
                value={newAccount.bankCode}
                onChange={(e) =>
                  setNewAccount((a) => ({ ...a, bankCode: e.target.value }))
                }
              >
                <option value="">Select bank</option>
                {banks.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">
                Account number
              </label>
              <input
                type="text"
                maxLength={10}
                className={inputCls}
                placeholder="0123456789"
                value={newAccount.accountNumber}
                onChange={(e) =>
                  setNewAccount((a) => ({
                    ...a,
                    accountNumber: e.target.value.replace(/[^\d]/g, ""),
                  }))
                }
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddAccount(false)}
                className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={addAccount}
                disabled={
                  addingAccount ||
                  newAccount.accountNumber.length !== 10 ||
                  !newAccount.bankCode
                }
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {addingAccount && (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}
                Verify &amp; save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Withdrawal form */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">
          Amount (₦)
        </label>
        <input
          type="number"
          min="500"
          className={inputCls}
          placeholder="500"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
        />
        {wallet && (
          <p className="mt-1.5 text-xs text-slate-500">
            Available: {fmt(wallet.balance)}
          </p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">
          Note (optional)
        </label>
        <input
          type="text"
          maxLength={50}
          className={inputCls}
          placeholder="Withdrawal note"
          value={form.narration}
          onChange={(e) =>
            setForm((f) => ({ ...f, narration: e.target.value }))
          }
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">
          Transaction PIN
        </label>
        <input
          type="password"
          maxLength={4}
          className={inputCls}
          placeholder="••••"
          value={form.pin}
          onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))}
        />
      </div>

      <button
        onClick={submitWithdrawal}
        disabled={
          submitting ||
          !selectedAccountId ||
          !form.amount ||
          form.pin.length !== 4
        }
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {submitting && <RefreshCw className="h-4 w-4 animate-spin" />}
        {submitting ? "Processing..." : "Withdraw"}
      </button>
    </div>
  );
}

// ─── SECURITY (PIN) PANEL ───────────────────────────────────────────────────────

function SecurityPanel() {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Set PIN (first time)
  const [setForm, setSetForm] = useState({ pin: "", confirmPin: "" });
  const [setting, setSetting] = useState(false);
  const [setResult, setSetResultMsg] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Change PIN
  const [changeForm, setChangeForm] = useState({
    currentPin: "",
    newPin: "",
    confirmNewPin: "",
  });
  const [changing, setChanging] = useState(false);
  const [changeResult, setChangeResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const checkPin = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/balance");
      // balance endpoint doesn't expose PIN status; fall back to attempting
      // a lightweight probe isn't ideal, so default to showing both flows.
      setHasPin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkPin();
  }, [checkPin]);

  const submitSetPin = async () => {
    if (setForm.pin.length !== 4 || setForm.pin !== setForm.confirmPin) return;
    setSetting(true);
    setSetResultMsg(null);
    try {
      const res = await fetch("/api/v1/wallet/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: setForm.pin,
          confirmPin: setForm.confirmPin,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to set PIN");
      setSetResultMsg({
        success: true,
        message: "Transaction PIN set successfully.",
      });
      setSetForm({ pin: "", confirmPin: "" });
    } catch (e: any) {
      setSetResultMsg({ success: false, message: e.message });
    } finally {
      setSetting(false);
    }
  };

  const submitChangePin = async () => {
    if (
      changeForm.newPin.length !== 4 ||
      changeForm.newPin !== changeForm.confirmNewPin
    )
      return;
    setChanging(true);
    setChangeResult(null);
    try {
      const res = await fetch("/api/v1/wallet/pin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPin: changeForm.currentPin,
          newPin: changeForm.newPin,
          confirmNewPin: changeForm.confirmNewPin,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to change PIN");
      setChangeResult({
        success: true,
        message: "Transaction PIN changed successfully.",
      });
      setChangeForm({ currentPin: "", newPin: "", confirmNewPin: "" });
    } catch (e: any) {
      setChangeResult({ success: false, message: e.message });
    } finally {
      setChanging(false);
    }
  };

  const pinInputCls = inputCls;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-200">
            Set transaction PIN
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          Required for all financial operations: purchases, transfers, and
          withdrawals. Use this if you haven't set a PIN yet.
        </p>
        {setResult && <ResultBanner result={setResult} />}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              New PIN
            </label>
            <input
              type="password"
              maxLength={4}
              className={pinInputCls}
              placeholder="••••"
              value={setForm.pin}
              onChange={(e) =>
                setSetForm((f) => ({
                  ...f,
                  pin: e.target.value.replace(/[^\d]/g, ""),
                }))
              }
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Confirm PIN
            </label>
            <input
              type="password"
              maxLength={4}
              className={pinInputCls}
              placeholder="••••"
              value={setForm.confirmPin}
              onChange={(e) =>
                setSetForm((f) => ({
                  ...f,
                  confirmPin: e.target.value.replace(/[^\d]/g, ""),
                }))
              }
            />
          </div>
        </div>
        <button
          onClick={submitSetPin}
          disabled={
            setting ||
            setForm.pin.length !== 4 ||
            setForm.pin !== setForm.confirmPin
          }
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {setting && <RefreshCw className="h-4 w-4 animate-spin" />}
          Set PIN
        </button>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-200">
            Change transaction PIN
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          If you already have a PIN, change it here. You'll need your current
          PIN.
        </p>
        {changeResult && <ResultBanner result={changeResult} />}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">
            Current PIN
          </label>
          <input
            type="password"
            maxLength={4}
            className={pinInputCls}
            placeholder="••••"
            value={changeForm.currentPin}
            onChange={(e) =>
              setChangeForm((f) => ({
                ...f,
                currentPin: e.target.value.replace(/[^\d]/g, ""),
              }))
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              New PIN
            </label>
            <input
              type="password"
              maxLength={4}
              className={pinInputCls}
              placeholder="••••"
              value={changeForm.newPin}
              onChange={(e) =>
                setChangeForm((f) => ({
                  ...f,
                  newPin: e.target.value.replace(/[^\d]/g, ""),
                }))
              }
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Confirm new PIN
            </label>
            <input
              type="password"
              maxLength={4}
              className={pinInputCls}
              placeholder="••••"
              value={changeForm.confirmNewPin}
              onChange={(e) =>
                setChangeForm((f) => ({
                  ...f,
                  confirmNewPin: e.target.value.replace(/[^\d]/g, ""),
                }))
              }
            />
          </div>
        </div>
        <button
          onClick={submitChangePin}
          disabled={
            changing ||
            changeForm.currentPin.length !== 4 ||
            changeForm.newPin.length !== 4 ||
            changeForm.newPin !== changeForm.confirmNewPin
          }
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {changing && <RefreshCw className="h-4 w-4 animate-spin" />}
          Change PIN
        </button>
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
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const tabs: { value: Tab; label: string; icon: React.ReactNode }[] = [
    {
      value: "overview",
      label: "Overview",
      icon: <Wallet className="h-4 w-4" />,
    },
    { value: "fund", label: "Fund", icon: <PiggyBank className="h-4 w-4" /> },
    {
      value: "transfer",
      label: "Transfer",
      icon: <Send className="h-4 w-4" />,
    },
    {
      value: "withdraw",
      label: "Withdraw",
      icon: <ArrowDownToLine className="h-4 w-4" />,
    },
    {
      value: "security",
      label: "Security",
      icon: <ShieldCheck className="h-4 w-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Wallet</h1>
          <p className="mt-1 text-sm text-slate-400">
            Fund your wallet, send money, withdraw to your bank, and manage your
            transaction PIN.
          </p>
        </div>

        {/* Tab nav */}
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50 p-1">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${tab === t.value ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          {tab === "overview" && (
            <OverviewPanel
              wallet={wallet}
              loading={loading}
              onRefresh={loadWallet}
            />
          )}
          {tab === "fund" && <FundPanel wallet={wallet} />}
          {tab === "transfer" && <TransferPanel />}
          {tab === "withdraw" && <WithdrawPanel wallet={wallet} />}
          {tab === "security" && <SecurityPanel />}
        </div>

        {/* Footer link */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <History className="h-3.5 w-3.5" />
          <a href="/transactions" className="hover:text-slate-300">
            View full transaction history
          </a>
        </div>
      </div>
    </div>
  );
}
