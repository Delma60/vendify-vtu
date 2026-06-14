// vtu-web/app/(dashboard)/cable/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Tv, RefreshCw, AlertCircle, CheckCircle2, Search, PlusCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = 'dstv' | 'gotv' | 'startimes';

interface Bouquet {
  id: string;
  name: string;
  code: string;
  priceKobo: number;
  validityDays: number;
  description?: string;
}

interface CardInfo {
  customerName: string;
  status: string;
  currentBouquetCode: string | null;
  currentBouquetName: string | null;
  dueDate: string | null;
  renewalAmountKobo: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROVIDERS: { value: Provider; label: string; color: string }[] = [
  { value: 'dstv', label: 'DStv', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { value: 'gotv', label: 'GOtv', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { value: 'startimes', label: 'StarTimes', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
];

const fmt = (k: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(k / 100);

const inputCls = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function CablePage() {
  const [provider, setProvider] = useState<Provider | ''>('');
  const [smartCard, setSmartCard] = useState('');
  const [pin, setPin] = useState('');

  const [verifying, setVerifying] = useState(false);
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);
  const [verifyError, setVerifyError] = useState('');

  const [bouquets, setBouquets] = useState<Bouquet[]>([]);
  const [addons, setAddons] = useState<Bouquet[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedBouquet, setSelectedBouquet] = useState<Bouquet | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load bouquets when provider changes
  const loadCatalogue = useCallback(async (p: Provider) => {
    setLoadingPlans(true);
    setBouquets([]);
    setAddons([]);
    setSelectedBouquet(null);
    setSelectedAddons(new Set());
    try {
      const res = await fetch(`/api/v1/cable?provider=${p}`);
      const data = await res.json();
      if (data.success) {
        setBouquets(data.data.bouquets ?? []);
        setAddons(data.data.addons ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  useEffect(() => {
    if (provider) loadCatalogue(provider);
  }, [provider, loadCatalogue]);

  // Reset card verification when provider or card number changes
  useEffect(() => {
    setCardInfo(null);
    setVerifyError('');
  }, [provider, smartCard]);

  const verifyCard = async () => {
    if (!provider || !smartCard) return;
    setVerifying(true);
    setVerifyError('');
    setCardInfo(null);
    try {
      const res = await fetch('/api/v1/verify/smartcard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smartCardNumber: smartCard, provider }),
      });
      const data = await res.json();
      if (!data.success) {
        setVerifyError(data.error ?? 'Could not verify this smart card.');
        return;
      }
      setCardInfo(data.data);

      // Pre-select the customer's current bouquet for renewal, if we have it
      if (data.data.currentBouquetCode) {
        const match = bouquets.find(b => b.code === data.data.currentBouquetCode);
        if (match) setSelectedBouquet(match);
      }
    } catch {
      setVerifyError('Network error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const toggleAddon = (id: string) => {
    setSelectedAddons(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalKobo =
    (selectedBouquet?.priceKobo ?? 0) +
    addons.filter(a => selectedAddons.has(a.id)).reduce((s, a) => s + a.priceKobo, 0);

  const canSubmit =
    !!provider && !!smartCard && !!cardInfo && !!selectedBouquet && pin.length === 4 && !submitting;

  const submit = async () => {
    if (!provider || !selectedBouquet) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/v1/cable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smartCardNumber: smartCard,
          provider,
          bouquetId: selectedBouquet.id,
          addonIds: Array.from(selectedAddons),
          transactionPin: pin,
          idempotencyKey: `cable-${Date.now()}-${smartCard}`,
        }),
      });
      const data = await res.json();
      setResult({ success: data.success, message: data.message ?? data.error });
      if (data.success) {
        setPin('');
        setSelectedAddons(new Set());
      }
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
            <Tv className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Cable TV</h1>
            <p className="text-sm text-slate-400">Renew or change your DStv, GOtv, or StarTimes subscription.</p>
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
            <div className="grid grid-cols-3 gap-2">
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

          {/* Smart card input + verify */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Smart card / IUC number</label>
            <div className="flex gap-2">
              <input
                type="text"
                className={inputCls}
                placeholder="1234567890"
                value={smartCard}
                onChange={e => setSmartCard(e.target.value)}
                disabled={!provider}
              />
              <button
                onClick={verifyCard}
                disabled={!provider || !smartCard || verifying}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40"
              >
                {verifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Verify
              </button>
            </div>
            {verifyError && <p className="mt-1.5 text-xs text-red-400">{verifyError}</p>}
            {cardInfo && (
              <div className="mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm">
                <p className="text-white font-medium">{cardInfo.customerName}</p>
                {cardInfo.currentBouquetName && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    Current bouquet: <span className="text-slate-200">{cardInfo.currentBouquetName}</span>
                    {cardInfo.dueDate && <> · Due {new Date(cardInfo.dueDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Bouquet picker */}
          {provider && cardInfo && (
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">
                Select bouquet {loadingPlans && <RefreshCw className="inline h-3 w-3 animate-spin ml-1" />}
              </label>
              {bouquets.length === 0 && !loadingPlans ? (
                <p className="text-sm text-slate-500">No bouquets available for this provider.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {bouquets.map(b => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBouquet(selectedBouquet?.id === b.id ? null : b)}
                      className={`rounded-xl border p-3 text-left transition ${selectedBouquet?.id === b.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-sm">{b.name}</span>
                        <span className="text-sm font-bold text-indigo-400">{fmt(b.priceKobo)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Valid {b.validityDays} day{b.validityDays !== 1 ? 's' : ''}
                        {b.code === cardInfo.currentBouquetCode ? ' · Current plan' : ''}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add-ons */}
          {provider && cardInfo && addons.length > 0 && (
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">Add-ons (optional)</label>
              <div className="space-y-2">
                {addons.map(a => (
                  <label
                    key={a.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 cursor-pointer transition ${selectedAddons.has(a.id) ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedAddons.has(a.id)}
                        onChange={() => toggleAddon(a.id)}
                        className="rounded"
                      />
                      <div>
                        <p className="text-sm font-medium text-white">{a.name}</p>
                        {a.description && <p className="text-xs text-slate-400">{a.description}</p>}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-indigo-400 flex items-center gap-1">
                      <PlusCircle className="h-3.5 w-3.5" /> {fmt(a.priceKobo)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Total */}
          {selectedBouquet && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-slate-400">Total (excl. fees)</span>
              <span className="text-lg font-bold text-white">{fmt(totalKobo)}</span>
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
              disabled={!selectedBouquet}
            />
          </div>

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting && <RefreshCw className="h-4 w-4 animate-spin" />}
            {submitting ? 'Processing...' : 'Pay & Renew'}
          </button>
        </div>
      </div>
    </div>
  );
}