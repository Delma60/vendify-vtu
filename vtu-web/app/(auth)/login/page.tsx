// vtu-web/app/(auth)/login/page.tsx
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Zap, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
  twoFactorCode: z.string().length(6, { message: 'Enter the 6-digit code from your app.' }).optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const router = useRouter();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const deviceToken = btoa(navigator.userAgent).slice(0, 16);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, deviceToken }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.code === 'TWO_FACTOR_REQUIRED') {
          setRequires2FA(true);
          return;
        }
        throw new Error(result.message || 'Incorrect email or password.');
      }

      setSuccessMessage('Logged in! Taking you to your dashboard…');
      setTimeout(() => { router.push('/dashboard') }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputBase = 'w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-orange-400 focus:bg-white transition-all';
  const inputWithIcon = `${inputBase} pl-10`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-white to-green-50 px-4 py-12">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 rounded-full bg-orange-200 opacity-20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-green-200 opacity-20 blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xl shadow-gray-200">

          {/* Logo */}
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-200">
              <Zap className="h-6 w-6 text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900">Welcome back</h1>
            <p className="mt-1.5 text-sm text-gray-500">Log in to your VendPro account</p>
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{errorMessage}</p>
            </div>
          )}
          {successMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-green-100 bg-green-50 p-4 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{successMessage}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!requires2FA ? (
              <>
                {/* Email */}
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Email address</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                    <input
                      {...register('email')}
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={inputWithIcon}
                    />
                  </div>
                  {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
                </div>

                {/* Password */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-700">Password</label>
                    <a href="/forgot-password" className="text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors">
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                    <input
                      {...register('password')}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className={`${inputWithIcon} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
                </div>
              </>
            ) : (
              /* 2FA step */
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="mb-4 rounded-xl bg-orange-50 border border-orange-100 p-4 text-sm text-orange-800">
                  <p className="font-semibold">Check your authenticator app</p>
                  <p className="mt-0.5 text-orange-600">Enter the 6-digit code to continue.</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Verification code</label>
                  <div className="relative">
                    <Smartphone className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-orange-400" />
                    <input
                      {...register('twoFactorCode')}
                      type="text"
                      maxLength={6}
                      placeholder="000000"
                      className={`${inputWithIcon} text-center text-xl font-mono tracking-widest`}
                    />
                  </div>
                  {errors.twoFactorCode && <p className="mt-1 text-xs text-red-600">{errors.twoFactorCode.message}</p>}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-200 hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Logging in…</>
              ) : requires2FA ? (
                'Verify code'
              ) : (
                'Log in'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 border-t border-gray-100 pt-5 text-center">
            <p className="text-sm text-gray-500">
              Don't have an account?{' '}
              <a href="/register" className="font-bold text-orange-500 hover:text-orange-600 transition-colors">
                Create one free
              </a>
            </p>
          </div>
        </div>

        {/* Below card */}
        <p className="mt-4 text-center text-xs text-gray-400">
          Your account is protected with end-to-end encryption and PIN verification.
        </p>
      </div>
    </div>
  );
}