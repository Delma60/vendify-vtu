// vtu-web/app/(dashboard)/electricity/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap, RefreshCw, CheckCircle2, AlertCircle, XCircle,
  Users, Clock, ChevronDown, ChevronRight, Search,
  FileText, Split, ArrowRight, User, Hash,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'buy' | 'split';
type MeterType = 'prepaid' | 'postpaid';
type SplitStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'paid' | 'cancelled';

interface MeterInfo {
  customerName: string;
  meterNumber: string;
  disco: string;
  type: MeterType;
  address: string | null;
  outstandingBalanceKobo: number | null;
}

interface FeeBreakdown {
  amountKobo: number;
  platformFeeKobo: number;
  vatKobo: number;
  totalFeeKobo: number;
  totalChargeKobo: number;
}

interface BillSplit {
  id: string;
  initiatorId: string;
  partnerId: string;
  disco: string;
  meterNumber: string;
  meterType: MeterType;
  customerName: string;
  totalAmountKobo: number;
  initiatorShareKobo: number;
  partnerShareKobo: number;
  status: SplitStatus;
  transactionId: string | null;
  initiatorPaid: boolean;
  partnerPaid: boolean;
  expiresAt: { _seconds: number };
  createdAt: { _seconds: number };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DISCOS = [
  { value: 'aedc',   label: 'Abuja (AEDC)' },
  { value: 'ikedc',  label: 'Ikeja (IKEDC)' },
  { value: 'ekedc',  label: 'Eko (EKEDC)' },
  { value: 'eedc',   label: 'Enugu (EEDC)' },
  { value: 'kedco',  label: 'Kano (KEDCO)' },
  { value: 'ibedc',  label: 'Ibadan (IBEDC)' },
  { value: 'jedc',   label: 'Jos (JEDC)' },
  { value: 'kaedco', label: 'Kaduna (KAEDCO)' },
  { value: 'phed',   label: 'Port Harcourt (PHED)' },
  { value: 'yedc',   label: 'Yola (YEDC)' },
  { value: 'phcn',   label: 'PHCN' },
] as const;

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (k: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(k / 100);

const fmtDate = (s: number) =>
  new Date(s * 1000).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const discoLabel = (v: string) =>
  DISCOS.find(d => d.value === v)?.label ?? v.toUpperCase();

const splitStatusStyle: Record<SplitStatus, string> = {
  pending:   'bg-amber-500/15 text-amber-400',
  accepted:  'bg-blue-500/15 text-blue-400',
  declined:  'bg-red-500/15 text-red-400',
  expired:   'bg-slate-700 text-slate-400',
  paid:      'bg-emerald-500/15 text-emerald-400',
  cancelled: 'bg-red-500/15 text-red-400',
};

// ─── Shared input class ───────────────────────────────────────────────────────

const inputCls = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition';
const selectCls = inputCls;

// ─── Result Banner ────────────────────────────────────────────────────────────

function ResultBanner({ result }: { result: { success: boolean; message: string } }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
      result.success
        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
        : 'border-red-500/20 bg-red-500/10 text-red-400'
    }`}>
      {result.success
        ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
        : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
      <span>{result.message}</span>
    </div>
  );
}

// ─── Token Display ────────────────────────────────────────────────────────────

function TokenCard({ token, units, disco, meterNumber, reference }: {
  token: string;
  units: string | null;
  disco: string;
  meterNumber: string;
  reference: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-400">Electricity Token</span>
        </div>
        <button
          onClick={copy}
          className="rounded-lg border border-emerald-500/30 px-3 py-1 text-xs text-emerald-400 hover:bg-emerald-500/10 transition"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <div className="font-mono text-2xl font-bold tracking-widest text-white text-center py-3 bg-slate-950/50 rounded-lg">
        {token}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
        <span>{discoLabel(disco)}</span>
        <span>Meter: {meterNumber}</span>
        {units && <span>~{units} kWh</span>}
        <span className="font-mono">{reference}</span>
      </div>
      <p className="mt-2 text-xs text-slate-500">Enter this token on your meter keypad. A copy has been sent to your email.</p>
    </div>
  );
}

// ─── BUY ELECTRICITY PANEL ────────────────────────────────────────────────────

function BuyElectricityPanel() {
  // Step 1: form fields
  const [meterNumber, setMeterNumber] = useState('');
  const [disco, setDisco] = useState('');
  const [meterType, setMeterType] = useState<MeterType>('prepaid');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');

  // Step 2: verification
  const [verifying, setVerifying] = useState(false);
  const [meterInfo, setMeterInfo] = useState<MeterInfo | null>(null);
  const [verifyError, setVerifyError] = useState('');

  // Step 3: fee preview
  const [feeData, setFeeData] = useState<FeeBreakdown | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);

  // Step 4: purchase
  const [purchasing, setPurchasing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [token, setToken] = useState<{ token: string; units: string | null; reference: string } | null>(null);

  // Verify meter
  const verifyMeter = async () => {
    if (!meterNumber || !disco) return;
    setVerifying(true);
    setVerifyError('');
    setMeterInfo(null);
    setFeeData(null);
    try {
      const res = await fetch('/api/v1/verify/meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meterNumber, disco, type: meterType }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Verification failed');
      setMeterInfo(data.data);
    } catch (e: any) {
      setVerifyError(e.message);
    } finally {
      setVerifying(false);
    }
  };

  // Load fee preview whenever amount changes
  useEffect(() => {
    if (!amount || Number(amount) <= 0) { setFeeData(null); return; }
    const kobo = Math.round(Number(amount) * 100);
    if (kobo < 50000) { setFeeData(null); return; }

    const timer = setTimeout(async () => {
      setFeeLoading(true);
      try {
        const res = await fetch(`/api/v1/electricity?amount=${kobo}`);
        const data = await res.json();
        if (data.success) setFeeData(data.data);
      } catch { /* ignore */ }
      finally { setFeeLoading(false); }
    }, 500);

    return () => clearTimeout(timer);
  }, [amount]);

  const handlePurchase = async () => {
    if (!meterInfo || !disco || !meterType || !amount || !pin) return;
    setPurchasing(true);
    setResult(null);
    setToken(null);
    try {
      const res = await fetch('/api/v1/electricity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meterNumber: meterInfo.meterNumber,
          disco,
          type: meterType,
          amount: Math.round(Number(amount) * 100),
          transactionPin: pin,
          idempotencyKey: `elec-${Date.now()}-${meterInfo.meterNumber}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ success: true, message: data.message ?? 'Payment successful!' });
        if (data.data?.token) {
          setToken({ token: data.data.token, units: data.data.units, reference: data.data.reference });
        }
        setPin('');
        setAmount('');
      } else {
        setResult({ success: false, message: data.error ?? 'Purchase failed' });
      }
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setPurchasing(false);
    }
  };

  const reset = () => {
    setMeterInfo(null);
    setMeterNumber('');
    setDisco('');
    setAmount('');
    setPin('');
    setResult(null);
    setToken(null);
    setVerifyError('');
    setFeeData(null);
  };

  const amountKobo = amount ? Math.round(Number(amount) * 100) : 0;
  const canVerify = meterNumber.length >= 6 && !!disco;
  const canBuy = !!meterInfo && amountKobo >= 50000 && !!pin;

  return (
    <div className="space-y-5">
      {result && <ResultBanner result={result} />}
      {token && (
        <TokenCard
          token={token.token}
          units={token.units}
          disco={disco}
          meterNumber={meterInfo?.meterNumber ?? meterNumber}
          reference={token.reference}
        />
      )}

      {/* Step 1: Meter details */}
      {!meterInfo ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Disco (electricity provider)</label>
              <select className={selectCls} value={disco} onChange={e => setDisco(e.target.value)}>
                <option value="">Select disco</option>
                {DISCOS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Meter type</label>
              <div className="flex gap-2">
                {(['prepaid', 'postpaid'] as MeterType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setMeterType(t)}
                    className={`flex-1 rounded-xl border py-3 text-sm font-medium capitalize transition ${
                      meterType === t
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-400'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Meter number</label>
            <div className="relative">
              <input
                type="text"
                className={inputCls + ' pr-12'}
                placeholder="Enter meter number"
                value={meterNumber}
                onChange={e => setMeterNumber(e.target.value.replace(/[^\d]/g, ''))}
              />
              <Hash className="absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
            </div>
          </div>

          {verifyError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> {verifyError}
            </div>
          )}

          <button
            onClick={verifyMeter}
            disabled={verifying || !canVerify}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            {verifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {verifying ? 'Verifying meter...' : 'Verify Meter'}
          </button>
        </div>
      ) : (
        /* Step 2: Verified — show customer info + payment form */
        <div className="space-y-4">
          {/* Customer info card */}
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-indigo-400">Meter verified ✓</span>
              <button onClick={reset} className="text-xs text-slate-400 hover:text-white transition">
                Change meter
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-slate-400">Customer</span>
              <span className="font-medium text-white">{meterInfo.customerName}</span>
              <span className="text-slate-400">Meter no.</span>
              <span className="font-mono text-white">{meterInfo.meterNumber}</span>
              <span className="text-slate-400">Disco</span>
              <span className="text-white">{discoLabel(disco)}</span>
              <span className="text-slate-400">Type</span>
              <span className="capitalize text-white">{meterType}</span>
              {meterInfo.address && (
                <>
                  <span className="text-slate-400">Address</span>
                  <span className="text-white text-xs">{meterInfo.address}</span>
                </>
              )}
              {meterInfo.outstandingBalanceKobo !== null && (
                <>
                  <span className="text-slate-400">Outstanding</span>
                  <span className="text-amber-400 font-medium">{fmt(meterInfo.outstandingBalanceKobo)}</span>
                </>
              )}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Amount (₦)</label>
            <input
              type="number"
              min="500"
              className={inputCls}
              placeholder="Minimum ₦500"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map(a => (
                <button
                  key={a}
                  onClick={() => setAmount(String(a))}
                  className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800 transition"
                >
                  ₦{a.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Fee preview */}
          {feeLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <RefreshCw className="h-3 w-3 animate-spin" /> Calculating fees...
            </div>
          )}
          {feeData && !feeLoading && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>Payment amount</span><span className="text-slate-200">{fmt(feeData.amountKobo)}</span>
              </div>
              {feeData.platformFeeKobo > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Platform fee</span><span className="text-slate-200">{fmt(feeData.platformFeeKobo)}</span>
                </div>
              )}
              {feeData.vatKobo > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>VAT</span><span className="text-slate-200">{fmt(feeData.vatKobo)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-800 pt-2 font-semibold">
                <span className="text-slate-300">Total charged</span>
                <span className="text-white">{fmt(feeData.totalChargeKobo)}</span>
              </div>
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
            />
          </div>

          <button
            onClick={handlePurchase}
            disabled={purchasing || !canBuy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            {purchasing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {purchasing ? 'Processing...' : `Pay ${feeData ? fmt(feeData.totalChargeKobo) : amount ? fmt(amountKobo) : 'Electricity Bill'}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── BILL SPLIT PANEL ─────────────────────────────────────────────────────────

function BillSplitPanel() {
  const [splits, setSplits] = useState<BillSplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedSplit, setExpandedSplit] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<Record<string, { success: boolean; message: string }>>({});

  // Create form
  const [form, setForm] = useState({
    partnerIdentifier: '',
    meterNumber: '',
    disco: '',
    meterType: 'prepaid' as MeterType,
    totalAmountNaira: '',
    myShareNaira: '',
  });
  const [verifying, setVerifying] = useState(false);
  const [meterInfo, setMeterInfo] = useState<MeterInfo | null>(null);
  const [verifyError, setVerifyError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ success: boolean; message: string } | null>(null);

  // Pay share state
  const [payPin, setPayPin] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/electricity/split');
      const data = await res.json();
      if (data.success) setSplits(data.data.splits ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const verifyMeter = async () => {
    if (!form.meterNumber || !form.disco) return;
    setVerifying(true);
    setVerifyError('');
    setMeterInfo(null);
    try {
      const res = await fetch('/api/v1/verify/meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meterNumber: form.meterNumber, disco: form.disco, type: form.meterType }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Verification failed');
      setMeterInfo(data.data);
    } catch (e: any) {
      setVerifyError(e.message);
    } finally { setVerifying(false); }
  };

  const createSplit = async () => {
    setCreating(true);
    setCreateResult(null);
    try {
      const total = Math.round(Number(form.totalAmountNaira) * 100);
      const myShare = Math.round(Number(form.myShareNaira) * 100);
      const res = await fetch('/api/v1/electricity/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerIdentifier: form.partnerIdentifier,
          meterNumber: form.meterNumber,
          disco: form.disco,
          meterType: form.meterType,
          totalAmount: total,
          initiatorShare: myShare,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateResult({ success: true, message: `Split created! Partner will pay ${fmt(data.data.partnerShareKobo)}.` });
        setShowCreate(false);
        setForm({ partnerIdentifier: '', meterNumber: '', disco: '', meterType: 'prepaid', totalAmountNaira: '', myShareNaira: '' });
        setMeterInfo(null);
        load();
      } else {
        setCreateResult({ success: false, message: data.error ?? 'Failed to create split' });
      }
    } finally { setCreating(false); }
  };

  const handleAction = async (splitId: string, action: 'pay' | 'decline') => {
    setActing(splitId);
    try {
      const body: Record<string, string> = { action };
      if (action === 'pay') {
        body.transactionPin = payPin[splitId] ?? '';
        body.idempotencyKey = `split-${splitId}-${Date.now()}`;
      }
      const res = await fetch(`/api/v1/electricity/split/${splitId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setActionResult(r => ({ ...r, [splitId]: { success: data.success, message: data.message ?? data.error ?? (data.success ? 'Done' : 'Failed') } }));
      if (data.success) load();
    } finally { setActing(null); }
  };

  const totalNaira = Number(form.totalAmountNaira);
  const myShareNaira = Number(form.myShareNaira);
  const partnerShare = totalNaira > 0 && myShareNaira > 0 ? totalNaira - myShareNaira : null;
  const canCreate = !!meterInfo && !!form.partnerIdentifier && totalNaira >= 1000 && myShareNaira > 0 && myShareNaira < totalNaira;

  return (
    <div className="space-y-5">
      {/* Create button */}
      {!showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-sm text-indigo-400 hover:bg-indigo-500/20 transition"
        >
          <Split className="h-4 w-4" /> Create bill split
        </button>
      )}

      {createResult && <ResultBanner result={createResult} />}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">New bill split</h3>
            <button onClick={() => { setShowCreate(false); setMeterInfo(null); setVerifyError(''); }} className="text-slate-400 hover:text-white">
              <XCircle className="h-4 w-4" />
            </button>
          </div>

          {/* Partner */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Partner (email, phone, or referral code)</label>
            <div className="relative">
              <input
                type="text"
                className={inputCls + ' pr-10'}
                placeholder="partner@email.com or 080xxxxxxxx"
                value={form.partnerIdentifier}
                onChange={e => setF('partnerIdentifier', e.target.value)}
              />
              <User className="absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
            </div>
          </div>

          {/* Disco + meter type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Disco</label>
              <select className={selectCls} value={form.disco} onChange={e => setF('disco', e.target.value)}>
                <option value="">Select</option>
                {DISCOS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Meter type</label>
              <div className="flex gap-2 h-[46px]">
                {(['prepaid', 'postpaid'] as MeterType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setF('meterType', t)}
                    className={`flex-1 rounded-xl border text-xs font-medium capitalize transition ${
                      form.meterType === t
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-400'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Meter number + verify */}
          {!meterInfo ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Meter number</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Enter meter number"
                  value={form.meterNumber}
                  onChange={e => setF('meterNumber', e.target.value.replace(/[^\d]/g, ''))}
                />
                <button
                  onClick={verifyMeter}
                  disabled={verifying || form.meterNumber.length < 6 || !form.disco}
                  className="shrink-0 rounded-xl border border-indigo-500/40 px-4 text-xs text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-40 transition"
                >
                  {verifying ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Verify'}
                </button>
              </div>
              {verifyError && <p className="mt-1.5 text-xs text-red-400">{verifyError}</p>}
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-emerald-400 font-medium">Meter verified ✓</span>
                <button onClick={() => setMeterInfo(null)} className="text-slate-400 hover:text-white text-xs">Change</button>
              </div>
              <p className="text-slate-300">{meterInfo.customerName}</p>
              <p className="text-slate-400 font-mono">{meterInfo.meterNumber}</p>
              {meterInfo.address && <p className="text-slate-500 mt-0.5">{meterInfo.address}</p>}
            </div>
          )}

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Total bill (₦)</label>
              <input type="number" min="1000" className={inputCls} placeholder="5000"
                value={form.totalAmountNaira} onChange={e => setF('totalAmountNaira', e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">My share (₦)</label>
              <input type="number" min="1" className={inputCls} placeholder="2500"
                value={form.myShareNaira} onChange={e => setF('myShareNaira', e.target.value)} />
            </div>
          </div>

          {partnerShare !== null && partnerShare > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Your share</span><span className="text-white font-medium">{fmt(myShareNaira * 100)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Partner's share</span><span className="text-white font-medium">{fmt(partnerShare * 100)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setShowCreate(false); setMeterInfo(null); setVerifyError(''); }}
              className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={createSplit}
              disabled={creating || !canCreate}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
            >
              {creating && <RefreshCw className="h-4 w-4 animate-spin" />}
              Send split request
            </button>
          </div>
        </div>
      )}

      {/* Existing splits list */}
      {loading ? (
        <div className="flex justify-center py-10">
          <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
        </div>
      ) : splits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 py-12 text-center">
          <Split className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">No bill splits yet.</p>
          <p className="text-xs text-slate-500 mt-1">Split electricity bills with friends, family, or flatmates.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {splits.map(split => {
            const isExpanded = expandedSplit === split.id;
            const res = actionResult[split.id];
            return (
              <div key={split.id} className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
                {/* Header row */}
                <button
                  onClick={() => setExpandedSplit(isExpanded ? null : split.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-800/30 transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white">{split.customerName}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${splitStatusStyle[split.status]}`}>
                        {split.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {discoLabel(split.disco)} · Meter {split.meterNumber} · Total {fmt(split.totalAmountKobo)}
                    </p>
                  </div>
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                  }
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-800 px-4 py-4 space-y-4">
                    {res && <ResultBanner result={res} />}

                    {/* Shares */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-center">
                        <p className="text-xs text-slate-400 mb-1">Initiator's share</p>
                        <p className="text-lg font-bold text-white">{fmt(split.initiatorShareKobo)}</p>
                        <p className={`text-xs mt-1 ${split.initiatorPaid ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {split.initiatorPaid ? '✓ Paid' : 'Pending'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-center">
                        <p className="text-xs text-slate-400 mb-1">Partner's share</p>
                        <p className="text-lg font-bold text-white">{fmt(split.partnerShareKobo)}</p>
                        <p className={`text-xs mt-1 ${split.partnerPaid ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {split.partnerPaid ? '✓ Paid' : 'Pending'}
                        </p>
                      </div>
                    </div>

                    {/* Expiry */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Expires {fmtDate(split.expiresAt._seconds)}</span>
                    </div>

                    {/* Action buttons for pending/accepted splits */}
                    {(split.status === 'pending' || split.status === 'accepted') && (
                      <div className="space-y-3">
                        {/* PIN input + Pay */}
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-400">Transaction PIN to pay your share</label>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              maxLength={4}
                              placeholder="••••"
                              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500"
                              value={payPin[split.id] ?? ''}
                              onChange={e => setPayPin(p => ({ ...p, [split.id]: e.target.value }))}
                            />
                            <button
                              onClick={() => handleAction(split.id, 'pay')}
                              disabled={acting === split.id || !payPin[split.id] || payPin[split.id].length < 4}
                              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
                            >
                              {acting === split.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                              Pay
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAction(split.id, 'decline')}
                          disabled={acting === split.id}
                          className="flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Decline split
                        </button>
                      </div>
                    )}

                    {/* Paid — show transaction ref */}
                    {split.status === 'paid' && split.transactionId && (
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
                        <span className="font-medium">Payment complete.</span> Ref: <span className="font-mono">{split.transactionId}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function ElectricityPage() {
  const [tab, setTab] = useState<Tab>('buy');

  const tabs: { value: Tab; label: string; icon: React.ReactNode }[] = [
    { value: 'buy',   label: 'Pay Bill',    icon: <Zap className="h-4 w-4" /> },
    { value: 'split', label: 'Bill Split',  icon: <Split className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
              <Zap className="h-5 w-5 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Electricity</h1>
          </div>
          <p className="mt-1 text-sm text-slate-400 ml-12">
            Pay prepaid & postpaid electricity bills. Token delivered instantly via email and SMS.
          </p>
        </div>

        {/* Tab nav */}
        <div className="mb-6 flex gap-1 rounded-xl border border-slate-800 bg-slate-900/50 p-1">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                tab === t.value ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          {tab === 'buy'   && <BuyElectricityPanel />}
          {tab === 'split' && <BillSplitPanel />}
        </div>

        {/* Info footer */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500 px-1">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Tokens delivered via email &amp; SMS
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Instant meter verification
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-indigo-400" />
            Split bills with anyone on VendPro
          </span>
        </div>
      </div>
    </div>
  );
}