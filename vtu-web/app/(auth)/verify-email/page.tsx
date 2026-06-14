// vtu-web/app/(auth)/verify-email/page.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Zap,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Mail,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";

// ─── Animated envelope hero ──────────────────────────────────────────────────
function EnvelopeHero({ email }: { email?: string }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 4), 900);
    return () => clearInterval(id);
  }, []);

  const dots = ".".repeat(tick + 1);

  // Masked email: ch***@gmail.com
  const masked = email
    ? email.replace(
        /^(.{2})(.*)(@.+)$/,
        (_, a, b, c) => a + "*".repeat(Math.min(b.length, 4)) + c,
      )
    : "your inbox";

  return (
    <div className="relative flex flex-col items-center">
      {/* Envelope SVG */}
      <div className="relative w-64 h-48 mx-auto mb-6">
        {/* Glow behind envelope */}
        <div
          className="absolute inset-0 rounded-full blur-3xl opacity-25"
          style={{
            background: "radial-gradient(circle, #F97316, transparent 70%)",
          }}
        />

        {/* Envelope body */}
        <svg
          viewBox="0 0 200 150"
          className="w-full h-full drop-shadow-2xl"
          fill="none"
        >
          {/* Body */}
          <rect
            x="10"
            y="40"
            width="180"
            height="105"
            rx="8"
            fill="rgba(255,255,255,0.12)"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1.5"
          />

          {/* Flap (open) */}
          <path
            d="M10 48 L100 90 L190 48"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1.5"
            fill="rgba(255,255,255,0.08)"
          />

          {/* Letter peeking out */}
          <rect
            x="50"
            y="15"
            width="100"
            height="70"
            rx="5"
            fill="rgba(255,255,255,0.95)"
          />

          {/* Code lines on letter */}
          <rect
            x="60"
            y="28"
            width="80"
            height="7"
            rx="3"
            fill="rgba(249,115,22,0.6)"
          />
          <rect
            x="68"
            y="42"
            width="64"
            height="5"
            rx="2.5"
            fill="rgba(249,115,22,0.3)"
          />
          <rect
            x="72"
            y="54"
            width="56"
            height="5"
            rx="2.5"
            fill="rgba(249,115,22,0.2)"
          />

          {/* VendPro label on envelope */}
          <text
            x="100"
            y="125"
            textAnchor="middle"
            fill="rgba(255,255,255,0.3)"
            fontSize="9"
            fontWeight="600"
            fontFamily="system-ui"
          >
            VendPro
          </text>

          {/* Animated sparkles */}
          <circle
            cx="168"
            cy="22"
            r="3"
            fill="#F97316"
            opacity={tick >= 1 ? 1 : 0.2}
          />
          <circle
            cx="178"
            cy="32"
            r="2"
            fill="#22C55E"
            opacity={tick >= 2 ? 1 : 0.2}
          />
          <circle
            cx="158"
            cy="14"
            r="2"
            fill="#FBBF24"
            opacity={tick >= 3 ? 1 : 0.2}
          />
        </svg>
      </div>

      {/* Status line */}
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm"
        style={{
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <span
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: "#22C55E" }}
        />
        <span style={{ color: "rgba(255,255,255,0.7)" }}>
          Code sent to <strong style={{ color: "#fff" }}>{masked}</strong>
          {dots}
        </span>
      </div>

      {/* Tip bubbles */}
      <div className="mt-8 space-y-3 w-full max-w-xs">
        {[
          { icon: "📬", text: "Check your spam folder if you don't see it" },
          { icon: "⏱", text: "The code is valid for 15 minutes" },
          { icon: "🔢", text: "Enter all 6 digits to verify" },
        ].map(({ icon, text }) => (
          <div
            key={text}
            className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <span className="text-base">{icon}</span>
            <span style={{ color: "rgba(255,255,255,0.55)" }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 6-digit OTP input ────────────────────────────────────────────────────────
function OtpInput({
  value,
  onChange,
  disabled,
  hasError,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  hasError?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const isProgFocus = useRef(false); // tracks programmatic vs user focus

  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  const focus = (i: number) => {
    isProgFocus.current = true;
    const el = refs.current[Math.max(0, Math.min(i, 5))];
    el?.focus();
    requestAnimationFrame(() => {
      el?.setSelectionRange(1, 1);
      isProgFocus.current = false;
    });
  };

  // Only snap to first empty on direct user click, not programmatic focus
  const handleFocus = (i: number) => {
    if (isProgFocus.current) return;
    const firstEmpty = digits.findIndex((d) => d === "");
    const target = firstEmpty === -1 ? 5 : firstEmpty;
    if (target !== i) {
      focus(target);
    }
  };

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) {
        const next = [...digits];
        next[i] = "";
        onChange(next.join("").trimEnd());
        focus(i);
      } else if (i > 0) {
        const next = [...digits];
        next[i - 1] = "";
        onChange(next.join("").trimEnd());
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === "ArrowRight" && i < 5) {
      e.preventDefault();
      focus(i + 1);
    }
  };

  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) return;

    if (raw.length > 1) {
      const pasted = raw.slice(0, 6);
      const next = Array.from({ length: 6 }, (_, idx) => pasted[idx] ?? "");
      onChange(next.join("").trimEnd());
      focus(Math.min(pasted.length, 5));
      return;
    }

    const next = [...digits];
    next[i] = raw[0];
    onChange(next.join("").trimEnd());
    if (i < 5) focus(i + 1);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (pasted) {
      const next = Array.from({ length: 6 }, (_, i) => pasted[i] ?? "");
      onChange(next.join("").trimEnd());
      focus(Math.min(pasted.length, 5));
      e.preventDefault();
    }
  };

  return (
    <div className="flex gap-3 justify-center">
      {Array.from({ length: 6 }).map((_, i) => {
        const filled = !!digits[i];
        const isActive =
          !disabled && (value.length === 6 ? i === 5 : i === value.length);
        return (
          <React.Fragment key={i}>
            {i === 3 && (
              <div
                className="self-center w-3 h-px flex-shrink-0"
                style={{ background: "#E5E7EB" }}
              />
            )}
            <input
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digits[i]}
              onChange={(e) => handleChange(i, e)}
              onKeyDown={(e) => handleKey(i, e)}
              onPaste={handlePaste}
              onFocus={() => handleFocus(i)}
              disabled={disabled}
              className="w-12 h-14 rounded-2xl text-center text-xl font-bold outline-none transition-all select-none"
              style={{
                background: filled ? "#FFF7ED" : "#F9FAFB",
                border: hasError
                  ? "2px solid #EF4444"
                  : isActive
                    ? "2px solid #F97316"
                    : filled
                      ? "2px solid #FDBA74"
                      : "2px solid #E5E7EB",
                color: "#111827",
                boxShadow: isActive
                  ? "0 0 0 4px rgba(249,115,22,0.12)"
                  : "none",
              }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}
// ─── Resend countdown ─────────────────────────────────────────────────────────
function ResendButton({ onResend }: { onResend: () => Promise<void> }) {
  const [seconds, setSeconds] = useState(60);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const handleResend = async () => {
    setResending(true);
    try {
      await onResend();
      setResent(true);
      setSeconds(60);
      setTimeout(() => setResent(false), 3000);
    } finally {
      setResending(false);
    }
  };

  if (resent) {
    return (
      <span
        className="flex items-center gap-1.5 text-sm font-medium"
        style={{ color: "#22C55E" }}
      >
        <CheckCircle2 className="w-4 h-4" /> New code sent!
      </span>
    );
  }

  if (seconds > 0) {
    return (
      <span className="text-sm" style={{ color: "#9CA3AF" }}>
        Resend code in{" "}
        <span
          className="font-semibold tabular-nums"
          style={{ color: "#6B7280" }}
        >
          {seconds}s
        </span>
      </span>
    );
  }

  return (
    <button
      onClick={handleResend}
      disabled={resending}
      className="flex items-center gap-1.5 text-sm font-semibold transition-colors disabled:opacity-60"
      style={{ color: "#F97316" }}
    >
      {resending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <RefreshCw className="w-4 h-4" />
      )}
      {resending ? "Sending…" : "Resend code"}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function VerifyEmailPage() {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // In production, get from session/query param. Mocked here for the page.
  const email =
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("email") ?? "")
      : "";

  const pendingUid =
    typeof window !== "undefined" ? sessionStorage.getItem("pending_uid") : "";

  const handleVerify = useCallback(async (code: string) => {
    if (code.length < 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: code, uid: pendingUid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 2000);
    } catch (e: any) {
      setError(e.message);
      setOtp("");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-submit when 6 digits are entered
  useEffect(() => {
    if (otp.length === 6 && !loading && !success) {
      handleVerify(otp);
    }
  }, [otp, loading, success, handleVerify]);

  const handleResend = async () => {
    const res = await fetch("/api/auth/verify-email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: pendingUid }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not resend code");
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#F9FAFB" }}
      >
        <div className="text-center max-w-sm mx-auto px-6">
          {/* Animated checkmark */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ background: "#22C55E" }}
            />
            <div
              className="relative w-20 h-20 rounded-full flex items-center justify-center shadow-xl"
              style={{ background: "#22C55E" }}
            >
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
          </div>

          <h2
            className="text-3xl font-black mb-2"
            style={{ color: "#111827", letterSpacing: "-0.02em" }}
          >
            You're verified! 🎉
          </h2>
          <p className="mb-6" style={{ color: "#6B7280" }}>
            Your email is confirmed. Taking you to your dashboard now…
          </p>

          <div
            className="flex items-center justify-center gap-2 text-sm"
            style={{ color: "#9CA3AF" }}
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            Redirecting…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#F9FAFB" }}>
      {/* ── Left: hero panel ─────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[52%] min-h-screen p-12 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(150deg, #111827 0%, #1C2A18 60%, #0F2A1A 100%)",
        }}
      >
        {/* Ambient orbs */}
        <div
          className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-20 pointer-events-none"
          style={{
            background: "radial-gradient(circle, #F97316, transparent 70%)",
            transform: "translate(-30%, -30%)",
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-15 pointer-events-none"
          style={{
            background: "radial-gradient(circle, #22C55E, transparent 70%)",
            transform: "translate(20%, 20%)",
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: "#F97316" }}
          >
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">
            VendPro
          </span>
        </div>

        {/* Centre content */}
        <div className="relative z-10 space-y-10">
          <div>
            <p
              className="text-sm font-semibold tracking-widest uppercase mb-4"
              style={{ color: "#F97316" }}
            >
              One last step
            </p>
            <h1
              className="text-5xl font-black leading-tight mb-5"
              style={{ color: "#fff", letterSpacing: "-0.03em" }}
            >
              Check your
              <br />
              <span style={{ color: "#F97316" }}>inbox.</span>
            </h1>
            <p
              className="text-lg leading-relaxed"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              We sent a 6-digit code to confirm your email. Enter it and you're
              in.
            </p>
          </div>

          <EnvelopeHero email={email} />
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            © 2025 VendPro · Secured by Flutterwave · Nigerian-owned
          </p>
        </div>
      </div>

      {/* ── Right: OTP form ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-16 xl:px-20">
        {/* Mobile logo */}

        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "#F97316" }}
          >
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base" style={{ color: "#111827" }}>
            VendPro
          </span>
        </div>

        <div className="w-full max-w-md">
          {/* Back link */}
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 text-sm mb-8 transition-colors"
            style={{ color: "#6B7280" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to registration
          </Link>

          {/* Mail icon */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-md"
            style={{
              background: "linear-gradient(135deg, #FFF7ED, #FFEDD5)",
              border: "1.5px solid #FDBA74",
            }}
          >
            <Mail className="w-7 h-7" style={{ color: "#F97316" }} />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2
              className="text-3xl font-black mb-1.5"
              style={{ color: "#111827", letterSpacing: "-0.02em" }}
            >
              Enter your code
            </h2>
            <p style={{ color: "#6B7280" }}>
              {email ? (
                <>
                  We sent a 6-digit code to{" "}
                  <strong style={{ color: "#374151" }}>{email}</strong>
                </>
              ) : (
                "We sent a 6-digit code to your email address."
              )}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-3 rounded-2xl px-4 py-3.5 mb-6 text-sm"
              style={{
                background: "#FEF2F2",
                border: "1.5px solid #FECACA",
                color: "#DC2626",
              }}
            >
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Incorrect code</p>
                <p className="text-xs mt-0.5 opacity-80">{error}</p>
              </div>
            </div>
          )}

          {/* OTP input */}
          <div className="mb-6">
            <OtpInput
              value={otp}
              onChange={setOtp}
              disabled={loading || success}
              hasError={!!error}
            />
          </div>

          {/* Verify button */}
          <button
            onClick={() => handleVerify(otp)}
            disabled={otp.length < 6 || loading || success}
            className="w-full py-4 rounded-2xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50 mb-4"
            style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying…
              </span>
            ) : (
              "Verify email →"
            )}
          </button>

          {/* Resend */}
          <div className="flex items-center justify-center">
            <ResendButton onResend={handleResend} />
          </div>

          {/* Progress indicator */}
          <div
            className="mt-10 pt-8"
            style={{ borderTop: "1.5px solid #F3F4F6" }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-4 text-center"
              style={{ color: "#9CA3AF" }}
            >
              Account setup
            </p>
            <div className="flex items-center gap-0">
              {[
                { label: "Register", done: true },
                { label: "Verify email", done: false, active: true },
                { label: "Set PIN", done: false },
                { label: "Fund wallet", done: false },
              ].map((step, i) => (
                <React.Fragment key={step.label}>
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                      style={{
                        background: step.done
                          ? "#22C55E"
                          : step.active
                            ? "#F97316"
                            : "#E5E7EB",
                        color: step.done || step.active ? "#fff" : "#9CA3AF",
                      }}
                    >
                      {step.done ? "✓" : i + 1}
                    </div>
                    <span
                      className="text-xs text-center leading-tight"
                      style={{
                        color: step.done
                          ? "#22C55E"
                          : step.active
                            ? "#F97316"
                            : "#9CA3AF",
                        fontWeight: step.active ? 600 : 400,
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < 3 && (
                    <div
                      className="flex-1 h-px mt-[-14px] mx-1"
                      style={{
                        background: i === 0 ? "#22C55E" : "#E5E7EB",
                      }}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Help */}
          <p className="text-center text-xs mt-6" style={{ color: "#9CA3AF" }}>
            Can't find the email?{" "}
            <a
              href="mailto:support@vendpro.ng"
              className="underline transition-colors"
              style={{ color: "#6B7280" }}
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
