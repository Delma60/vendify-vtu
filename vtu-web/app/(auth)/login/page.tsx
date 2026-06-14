// vtu-web/app/(auth)/login/page.tsx
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Zap, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Loader2, 
  ShieldAlert, 
  CheckCircle2,
  Smartphone
} from 'lucide-react';

// ─── VALIDATION SCHEMA ────────────────────────────────────────────────────────
// Enforces precise credential shapes matching your backend rules
const loginSchema = z.object({
  email: z.string().email({ message: 'Please provide a valid business email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long.' }),
  twoFactorCode: z.string().length(6, { message: '2FA verification pin must be exactly 6 digits.' }).optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // ─── AUTHENTICATION SUBMISSION FLOW ─────────────────────────────────────────
  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Mocking device metadata fingerprinting payload for fraud engines
      const mockDeviceFingerprint = btoa(navigator.userAgent).slice(0, 16);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          deviceToken: mockDeviceFingerprint,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle explicit 2FA challenge interception
        if (result.code === 'TWO_FACTOR_REQUIRED') {
          setRequires2FA(true);
          return;
        }
        throw new Error(result.message || 'Invalid operational credentials.');
      }

      setSuccessMessage('Authentication identity validated. Redirecting to terminal workspace...');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);

    } catch (err: any) {
      setErrorMessage(err.message || 'A critical network or structural error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8 relative selection:bg-indigo-500 selection:text-white">
      {/* Decorative ambient background blur grids */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-950/20 via-slate-950 to-slate-950" />

      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-900 bg-slate-900/40 p-8 backdrop-blur-xl shadow-2xl shadow-indigo-500/5">
        
        {/* BRANDING HEADER */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
            Welcome back to Vendify
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Securely access your utility distribution terminal
          </p>
        </div>

        {/* NOTIFICATION FEEDBACK TOASTS */}
        {errorMessage && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            <ShieldAlert className="h-5 w-5 flex-shrink-0 text-red-400" />
            <p>{errorMessage}</p>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-400" />
            <p>{successMessage}</p>
          </div>
        )}

        {/* MAIN IDENTITY FORM */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          
          {!requires2FA ? (
            <>
              {/* EMAIL CHANNEL INPUT */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Business Email Address
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    {...register('email')}
                    type="email"
                    autoComplete="email"
                    className="block w-full rounded-xl border border-slate-800 bg-slate-950/60 py-3 pl-10 pr-4 text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                    placeholder="name@company.com"
                  />
                </div>
                {errors.email && (
                  <p className="text-xs font-medium text-red-400 mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* SECURITY CREDENTIALS INPUT */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Account Security Key
                  </label>
                  <a href="/forgot-password" className="text-xs font-medium text-indigo-400 transition hover:text-indigo-300">
                    Reset key?
                  </a>
                </div>
                <div className="relative rounded-xl shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="block w-full rounded-xl border border-slate-800 bg-slate-950/60 py-3 pl-10 pr-10 text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs font-medium text-red-400 mt-1">{errors.password.message}</p>
                )}
              </div>
            </>
          ) : (
            /* MULTI-FACTOR AUTHENTICATION INTERCEPT CHALLENGE */
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Multi-Factor OTP Challenge
              </label>
              <p className="text-xs text-slate-400 mb-2">
                Please insert the token dispatched to your synchronized device profile.
              </p>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Smartphone className="h-4 w-4 text-indigo-400" />
                </div>
                <input
                  {...register('twoFactorCode')}
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  className="block w-full rounded-xl border border-slate-800 bg-slate-950/60 py-3 pl-10 text-center text-lg font-mono tracking-widest text-white placeholder-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
              {errors.twoFactorCode && (
                <p className="text-xs font-medium text-red-400 mt-1">{errors.twoFactorCode.message}</p>
              )}
            </div>
          )}

          {/* SUBMIT BUTTON TRIGGER */}
          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Evaluating Parameters...
              </>
            ) : requires2FA ? (
              'Verify Dynamic Passcode'
            ) : (
              'Initialize Terminal Session'
            )}
          </button>
        </form>

        {/* BOTTOM NAVIGATION FOOTER */}
        <div className="text-center pt-4 border-t border-slate-900">
          <p className="text-sm text-slate-500">
            New infrastructure partner?{' '}
            <a href="/register" className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
              Deploy Free Sandbox
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}