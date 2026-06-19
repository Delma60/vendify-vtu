// vtu-web/app/e/[slug]/page.tsx
// AGENTS.md RULES: #1 (kobo), #13 (data from Firestore via API, never hardcoded)
// Public, shareable claim page. Reads from GET /api/v1/campaign-events/[slug],
// claims via POST /api/v1/campaign-events/[slug]/claim. No auth required to view;
// auth required to claim.

'use client';

import { use, useEffect, useState } from 'react';
import {
  Gift, Wallet, Sparkles, Award, Clock, ArrowRight,
  CheckCircle2, AlertCircle, Loader2, LogIn, Frown,
} from 'lucide-react';
import { useParams } from 'next/navigation';

// ─── Types (mirrors the GET /api/v1/campaign-events/[slug] response) ──────────

type RewardType = 'wallet_credit' | 'loyalty_points' | 'badge';

interface PreviewReward {
  type: RewardType;
  walletCreditKobo?: number;
  loyaltyPoints?: number;
  badgeLabel?: string;
}

interface EventPreview {
  name: string;
  description: string;
  rewards: PreviewReward[];
  endDate: string; // ISO
  isClaimable: boolean;
  isLoggedIn: boolean;
  alreadyClaimed: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const nairaFmt = (kobo: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(kobo / 100);

function timeUntil(iso: string): { label: string; expired: boolean } {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return { label: 'This link has ended', expired: true };

  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) return { label: `Ends in ${days} day${days > 1 ? 's' : ''}`, expired: false };
  if (hours >= 1) return { label: `Ends in ${hours} hour${hours > 1 ? 's' : ''}`, expired: false };
  return { label: `Ends in ${Math.max(mins, 1)} min`, expired: false };
}

function rewardLabel(r: PreviewReward): string {
  if (r.type === 'wallet_credit') return nairaFmt(r.walletCreditKobo ?? 0);
  if (r.type === 'loyalty_points') return `${r.loyaltyPoints ?? 0} points`;
  return r.badgeLabel ?? 'Badge';
}

function rewardIcon(type: RewardType) {
  if (type === 'wallet_credit') return <Wallet className="h-5 w-5" />;
  if (type === 'loyalty_points') return <Sparkles className="h-5 w-5" />;
  return <Award className="h-5 w-5" />;
}

function rewardTint(type: RewardType) {
  if (type === 'wallet_credit') return 'bg-orange-50 text-orange-600';
  if (type === 'loyalty_points') return 'bg-green-50 text-green-600';
  return 'bg-amber-50 text-amber-600';
}

function claimButtonLabel(rewards: PreviewReward[]): string {
  if (rewards.length === 1 && rewards[0].type === 'wallet_credit') {
    return `Claim ${nairaFmt(rewards[0].walletCreditKobo ?? 0)}`;
  }
  return 'Claim my reward';
}

// ─── Shell (shared chrome for every state) ─────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-green-50 flex items-start justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

// ─── Reward list (used in both preview and success states) ───────────────────

function RewardList({ rewards }: { rewards: PreviewReward[] }) {
  return (
    <div className="space-y-2">
      {rewards.map((r, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${rewardTint(r.type)}`}>
            {rewardIcon(r.type)}
          </span>
          <span className="font-semibold text-slate-900">{rewardLabel(r)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Hero (gradient card — the "floating top-up card" signature from the brand) ─

function Hero({ name, description }: { name: string; description: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 to-green-500 px-7 pt-9 pb-14 text-white shadow-lg shadow-orange-500/20">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
      <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-white/10" />
      <div className="relative">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
          <Gift className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold leading-tight sm:text-3xl">{name}</h1>
        {description && <p className="mt-2 text-sm text-white/90">{description}</p>}
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function ClaimEventPage({ params }: { params: Promise<{ slug: string }> }) {
//   const { slug } = use(params);
  const { slug } = useParams()

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [event, setEvent] = useState<EventPreview | null>(null);

  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [claimed, setClaimed] = useState(false);
  const [rewardsGiven, setRewardsGiven] = useState<PreviewReward[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/v1/campaign-events/${slug}`);
        const data = await res.json();
        if (cancelled) return;

        if (res.status === 404 || !data.success) {
          setNotFound(true);
          return;
        }

        setEvent(data.data);
        if (data.data.alreadyClaimed) setClaimed(true);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [slug]);

  const handleClaim = async () => {
    setClaiming(true);
    setClaimError('');
    try {
      const res = await fetch(`/api/v1/campaign-events/${slug}/claim`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.code === 'ALREADY_CLAIMED') {
          setClaimed(true);
          return;
        }
        throw new Error(data.error ?? "Couldn't claim this right now. Try again.");
      }

      setRewardsGiven(data.data.rewardsGiven ?? []);
      setClaimed(true);
    } catch (e: any) {
      setClaimError(e.message);
    } finally {
      setClaiming(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
          <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
          <p className="text-sm">Loading your reward...</p>
        </div>
      </PageShell>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (notFound || !event) {
    return (
      <PageShell>
        <div className="rounded-3xl border border-slate-100 bg-white p-10 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Frown className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-lg font-bold text-slate-900">This link doesn&rsquo;t exist</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            It may have been removed, or you might have the wrong link. Double-check it and try again.
          </p>
          <a
            href="/"
            className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Go home <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </PageShell>
    );
  }

  const { label: endLabel, expired } = timeUntil(event.endDate);

  // ── Already claimed / just claimed ───────────────────────────────────────────
  if (claimed) {
    const displayRewards = rewardsGiven.length ? rewardsGiven : event.rewards;
    return (
      <PageShell>
        <Hero name={event.name} description={event.description} />
        <div className="relative z-10 -mt-8 mx-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-xl">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h2 className="mt-3 text-lg font-bold text-slate-900">You&rsquo;ve got this one already</h2>
            <p className="mt-1 text-sm text-slate-500">Here&rsquo;s what landed in your account:</p>
          </div>
          <div className="mt-5">
            <RewardList rewards={displayRewards} />
          </div>
          <a
            href="/dashboard/wallet"
            className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            View your wallet <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </PageShell>
    );
  }

  // ── Not logged in ────────────────────────────────────────────────────────────
  if (!event.isLoggedIn) {
    return (
      <PageShell>
        <Hero name={event.name} description={event.description} />
        <div className="relative z-10 -mt-8 mx-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-xl">
          <p className="mb-3 text-xs font-semibold text-slate-500">Here&rsquo;s what you get</p>
          <RewardList rewards={event.rewards} />

          <a
            href={`/login?redirect=/e/${slug}`}
            className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600"
          >
            <LogIn className="h-4 w-4" /> Log in to claim
          </a>
          <p className="mt-3 text-center text-xs text-slate-400">
            New here?{' '}
            <a href={`/register?redirect=/e/${slug}`} className="font-semibold text-orange-600 hover:underline">
              Create an account in seconds
            </a>
          </p>

          {!expired && (
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5" /> {endLabel}
            </p>
          )}
        </div>
      </PageShell>
    );
  }

  // ── Logged in, but not currently claimable ──────────────────────────────────
  if (!event.isClaimable) {
    return (
      <PageShell>
        <Hero name={event.name} description={event.description} />
        <div className="relative z-10 -mt-8 mx-4 rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-xl">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Clock className="h-6 w-6" />
          </span>
          <h2 className="mt-3 text-lg font-bold text-slate-900">
            {expired ? 'This offer has ended' : "This offer isn't live yet"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {expired ? "It's no longer accepting claims." : 'Check back soon, or watch out for an update.'}
          </p>
          <a
            href="/dashboard"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Go to your dashboard
          </a>
        </div>
      </PageShell>
    );
  }

  // ── Logged in, claimable — the main event ────────────────────────────────────
  return (
    <PageShell>
      <Hero name={event.name} description={event.description} />
      <div className="relative z-10 -mt-8 mx-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-xl">
        <p className="mb-3 text-xs font-semibold text-slate-500">Here&rsquo;s what you get</p>
        <RewardList rewards={event.rewards} />

        {claimError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {claimError}
          </div>
        )}

        <button
          onClick={handleClaim}
          disabled={claiming}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 disabled:opacity-60"
        >
          {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
          {claiming ? 'Claiming...' : claimButtonLabel(event.rewards)}
        </button>

        {!expired && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" /> {endLabel}
          </p>
        )}
      </div>
    </PageShell>
  );
}