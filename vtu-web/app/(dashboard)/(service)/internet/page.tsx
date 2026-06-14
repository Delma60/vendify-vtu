// vtu-web/app/(dashboard)/internet/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, RefreshCw, AlertCircle, CheckCircle2, Search } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = 'smile' | 'spectranet';

interface Plan {
  id: string;
  name: string;
  dataLabel: string;
  validityDays: number;
  priceKobo: number;
}

interface AccountInfo {
  customerName: string;
  status: string;
  currentPlanName: string | null;
  expiryDate: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROVIDERS: { value: Provider; label: string; color: string }[] = [
  { value: 'smile', label: 'Smile', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  { value: 'spectranet', label: 'Spectranet', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
];

const fmt = (k: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(k / 100);

const inputCls = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function InternetPage() {
  const [provider, setProvider] = useState<Provider | ''>('');
  const [accountNumber, setAccountNumber] = useState('');
  const [pin, setPin] = useState('');

  const [verifying, setVerifying] = useState(false);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [verifyError, setVerifyError] = useState('');

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadPlans = useCallback(async (p: Provider) => {
    setLoadingPlans(true);
    setPlans([]);
    setSelectedPlan(null);
    try {
      const res = await fetch(`/api/v1/internet?provider=${p}`);
      const data = await res.json();
      if (data.success) setPlans(data.data.plans ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  useEffect(() => {
    if (provider) loadPlans(provider);
  }, [provider, loadPlans]);

  useEffect(() => {
    setAccountInfo(null);
    setVerifyError('');
  }, [provider, accountNumber]);

  const verifyAccount = async () => {
    if (!provider || !accountNumber) return;
    setVerifying(true);
    setVerifyError('');
    setAccountInfo(null);
    try {
      const res = await fetch('/api/v1/verify/internet-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber, provider }),
      });
      const data = await res.json();
      if (!data.success) {
        setVerifyError(data.error ?? 'Could not verify this account number.');
        return;
      }
      setAccountInfo(data.data);
    } catch {
      setVerifyError('Network error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const canSubmit =
    !!provider && !!accountNumber && !!accountInfo && !!selectedPlan && pin.length === 4 && !submitting;

  const submit = async () => {
    if (!provider || !selectedPlan) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/v1/internet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountNumber,
          provider,
          planId: selectedPlan.id,
          transactionPin: pin,
          idempotencyKey: `internet-${Date.now()}-${accountNumber}`,
        }),
      });
      const data = await res.json();
      setResult({ success: data.success, message: data.message ?? data.error });
      if (data.success) setPin('');
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <Wifi className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Internet Subscriptions</h1>
            <p className="text-sm text-slate-400">Top up your Smile or Spectranet internet plan.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
          {result && (
            <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${result.success ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>
              {result.success ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
              {result.message}
            </div>
          )}

          {/* Provider selector */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Provider</label>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setProvider(p.value)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${provider === p.value ? p.color : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Account number input + verify */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Account number</label>
            <div className="flex gap-2">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. 0123456789"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
                disabled={!provider}
              />
              <button
                onClick={verifyAccount}
                disabled={!provider || !accountNumber || verifying}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40"
              >
                {verifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Verify
              </button>
            </div>
            {verifyError && <p className="mt-1.5 text-xs text-red-400">{verifyError}</p>}
            {accountInfo && (
              <div className="mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm">
                <p className="text-white font-medium">{accountInfo.customerName}</p>
                {accountInfo.currentPlanName && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    Current plan: <span className="text-slate-200">{accountInfo.currentPlanName}</span>
                    {accountInfo.expiryDate && <> · Expires {new Date(accountInfo.expiryDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Plan picker */}
          {provider && accountInfo && (
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">
                Select plan {loadingPlans && <RefreshCw className="inline h-3 w-3 animate-spin ml-1" />}
              </label>
              {plans.length === 0 && !loadingPlans ? (
                <p className="text-sm text-slate-500">No plans available for this provider.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {plans.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlan(selectedPlan?.id === p.id ? null : p)}
                      className={`rounded-xl border p-3 text-left transition ${selectedPlan?.id === p.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-sm">{p.dataLabel}</span>
                        <span className="text-sm font-bold text-indigo-400">{fmt(p.priceKobo)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">{p.name} · {p.validityDays} day{p.validityDays !== 1 ? 's' : ''}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PIN */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Transaction PIN</label>
            <input
              type="password"
              maxLength={4}
              className={inputCls}
              placeholder="••••"
              value={pin}
              onChange={e => setPin(e.target.value)}
              disabled={!selectedPlan}
            />
          </div>

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting && <RefreshCw className="h-4 w-4 animate-spin" />}
            {submitting ? 'Processing...' : 'Pay & Activate'}
          </button>
        </div>
      </div>
    </div>
  );
}