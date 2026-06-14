// vtu-web/app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Cpu, 
  Coins, 
  Layers, 
  CheckCircle2, 
  ShieldCheck, 
  Smartphone, 
  Code, 
  ArrowRight 
} from 'lucide-react';

interface FeaturePlan {
  apiAccess: boolean;
  bucketAccess: boolean;
  loanAccess: boolean;
  whitelabelAccess: boolean;
  maxDailyTransactions: number | null;
  rateDiscount: number;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number; // in kobo
  annualPrice: number;  // in kobo
  features: FeaturePlan;
}

export default function LandingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Dynamic initialization fetching raw plan structures from the unified database
  useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await fetch('/api/v1/plans');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.plans) {
            setPlans(data.plans);
          }
        }
      } catch (err) {
        console.error('Failed fetching core plans:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
      
      {/* ─── NAVIGATION BAR ────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Vendify<span className="text-indigo-500">.vtu</span>
            </span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-slate-400 transition hover:text-white">Features</a>
            <a href="#pricing" className="text-sm font-medium text-slate-400 transition hover:text-white">Pricing</a>
            <a href="#api" className="text-sm font-medium text-slate-400 transition hover:text-white">Developer API</a>
          </div>
          <div className="flex items-center gap-4">
            <a href="/login" className="text-sm font-medium text-slate-300 transition hover:text-white">Sign In</a>
            <a href="/register" className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* ─── HERO SECTION ──────────────────────────────────────── */}
      <header className="relative overflow-hidden pt-24 pb-20 md:pt-32 lg:pb-32">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950" />
        <div className="mx-auto max-w-7xl px-6 text-center lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-400 backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5" /> Fully secure Flutterwave integrated pipelines
            </div>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-6xl bg-gradient-to-b from-white to-slate-300 bg-clip-text">
              The Sovereign Engine for VTU Vending & Utility APIs
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-400">
              Deploy automated digital telecommunication inventories effortlessly. Disburse airtime, sub-meter data configurations, cable subscriptions, or embed flexible retail loan structures directly.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <a href="/register" className="group rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-indigo-500 hover:shadow-indigo-500/10 flex items-center gap-2">
                Launch Virtual Wallet 
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a href="#api" className="rounded-xl border border-slate-800 bg-slate-900/50 px-6 py-3.5 text-sm font-semibold text-slate-300 backdrop-blur-sm transition hover:bg-slate-900 hover:text-white">
                Developer SDK Documentation
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* ─── CORE PLATFORM FEATURES ────────────────────────────── */}
      <section id="features" className="py-24 border-y border-slate-900 bg-slate-950/40 relative">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold uppercase tracking-wider text-indigo-500">Enterprise Core Capabilities</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Everything required to rule the virtual grid.</p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-12 lg:max-w-none lg:grid-cols-3">
              
              <div className="flex flex-col rounded-2xl border border-slate-900 bg-slate-900/20 p-8 backdrop-blur-sm">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <Smartphone className="h-5 w-5 text-indigo-400" />
                  </div>
                  High-Speed Telecommunications Vending
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-400">
                  <p className="flex-auto">Deploy lightning-fast API operations tracking airtime/data options for MTN, Airtel, Glo, and 9mobile within milliseconds.</p>
                </dd>
              </div>

              <div className="flex flex-col rounded-2xl border border-slate-900 bg-slate-900/20 p-8 backdrop-blur-sm">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <Code className="h-5 w-5 text-indigo-400" />
                  </div>
                  Developer First REST API
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-400">
                  <p className="flex-auto">Integrated endpoint security infrastructure featuring multi-token provisioning, webhook tracking, and explicit rate limit configurations.</p>
                </dd>
              </div>

              <div className="flex flex-col rounded-2xl border border-slate-900 bg-slate-900/20 p-8 backdrop-blur-sm">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <Coins className="h-5 w-5 text-indigo-400" />
                  </div>
                  Dynamic Credit & Cashbacks
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-400">
                  <p className="flex-auto">Automated cashback mechanics calculate split percentages on each volume sequence, boosting yield metrics across distributed downlines.</p>
                </dd>
              </div>

            </dl>
          </div>
        </div>
      </section>

      {/* ─── DYNAMIC PRICING COMPARISON ────────────────────────── */}
      <section id="pricing" className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-base font-semibold text-indigo-500 uppercase tracking-widest">Pricing Strategy</h2>
            <p className="mt-2 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Select your structural distribution tier.</p>
            <p className="mt-4 text-base text-slate-400">Enjoy 2 months free with annual billing cycles.</p>

            {/* Billing Toggle Switch */}
            <div className="mt-10 flex justify-center">
              <div className="relative flex rounded-full bg-slate-900 p-1 border border-slate-800">
                <button 
                  onClick={() => setBillingPeriod('monthly')}
                  className={`${billingPeriod === 'monthly' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'} rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all`}
                >
                  Monthly Cycle
                </button>
                <button 
                  onClick={() => setBillingPeriod('annual')}
                  className={`${billingPeriod === 'annual' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'} rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all`}
                >
                  Annual (2 Months Free)
                </button>
              </div>
            </div>
          </div>

          {/* Pricing Blocks Container */}
          {loading ? (
            <div className="mt-16 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            </div>
          ) : (
            <div className="mx-auto mt-16 grid max-w-lg grid-cols-1 gap-y-6 sm:mt-20 lg:max-w-none lg:grid-cols-4 lg:gap-x-4">
              {plans.map((plan) => {
                const isEnterprise = plan.name.toLowerCase() === 'enterprise';
                const basePriceKobo = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
                const displayPrice = (basePriceKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0 });

                return (
                  <div 
                    key={plan.id}
                    className={`flex flex-col justify-between rounded-3xl p-8 xl:p-10 transition-all border ${
                      isEnterprise 
                        ? 'bg-gradient-to-b from-indigo-950/50 to-slate-950 border-indigo-500 shadow-xl shadow-indigo-500/5 relative lg:-translate-y-4' 
                        : 'bg-slate-900/40 border-slate-900 hover:border-slate-800'
                    }`}
                  >
                    {isEnterprise && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-2xs font-bold uppercase tracking-widest text-white">
                        Recommended Tier
                      </span>
                    )}
                    <div>
                      <h3 className="text-lg font-bold text-white capitalize">{plan.name}</h3>
                      <p className="mt-2 text-sm text-slate-400 min-h-[40px]">{plan.description}</p>
                      <p className="mt-6 flex items-baseline gap-x-1">
                        <span className="text-4xl font-extrabold tracking-tight text-white">₦{displayPrice}</span>
                        <span className="text-sm font-semibold text-slate-400">/{billingPeriod === 'monthly' ? 'mo' : 'yr'}</span>
                      </p>

                      <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-slate-300 border-t border-slate-900 pt-6">
                        <li className="flex gap-x-3">
                          <CheckCircle2 className="h-5 w-5 flex-none text-indigo-400" />
                          <span>Max Daily Txs: <strong>{plan.features.maxDailyTransactions ?? 'Unlimited'}</strong></span>
                        </li>
                        <li className="flex gap-x-3">
                          <CheckCircle2 className="h-5 w-5 flex-none text-indigo-400" />
                          <span>Utility Discount: <strong>{plan.features.rateDiscount}% Across Board</strong></span>
                        </li>
                        <li className={`${plan.features.apiAccess ? 'text-slate-200' : 'text-slate-600 line-through'} flex gap-x-3`}>
                          <CheckCircle2 className={`h-5 w-5 flex-none ${plan.features.apiAccess ? 'text-indigo-400' : 'text-slate-700'}`} />
                          <span>Production API Endpoint Hooks</span>
                        </li>
                        <li className={`${plan.features.loanAccess ? 'text-slate-200' : 'text-slate-600 line-through'} flex gap-x-3`}>
                          <CheckCircle2 className={`h-5 w-5 flex-none ${plan.features.loanAccess ? 'text-indigo-400' : 'text-slate-700'}`} />
                          <span>Micro-Credit Infrastructure Access</span>
                        </li>
                        <li className={`${plan.features.whitelabelAccess ? 'text-slate-200' : 'text-slate-600 line-through'} flex gap-x-3`}>
                          <CheckCircle2 className={`h-5 w-5 flex-none ${plan.features.whitelabelAccess ? 'text-indigo-400' : 'text-slate-700'}`} />
                          <span>Custom White-Label Subdomain Setup</span>
                        </li>
                      </ul>
                    </div>
                    <a
                      href={`/register?plan=${plan.id}&cycle=${billingPeriod}`}
                      className={`mt-8 block w-full rounded-xl py-3 px-4 text-center text-sm font-semibold transition-all ${
                        isEnterprise 
                          ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/10' 
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      Provision {plan.name} Tier
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────────── */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12 text-center text-sm text-slate-500">
        <p>© 2026 Vendify VTU System Network. All rights managed securely via Flutterwave infrastructure.</p>
      </footer>
    </div>
  );
}