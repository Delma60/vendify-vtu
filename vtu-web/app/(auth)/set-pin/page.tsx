// vtu-web/app/(auth)/set-pin/page.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Zap,
  Shield,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  AlertCircle,
  Lock,
} from "lucide-react";

// ─── 4-digit PIN input ────────────────────────────────────────────────────────

function PinInput({
  value,
  onChange,
  disabled,
  hasError,
  masked,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  masked: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const isProgFocus = useRef(false);

  const digits = Array.from({ length: 4 }, (_, i) => value[i] ?? "");

  const focus = (i: number) => {
    isProgFocus.current = true;
    const el = refs.current[Math.max(0, Math.min(i, 3))];
    el?.focus();
    requestAnimationFrame(() => {
      el?.setSelectionRange(1, 1);
      isProgFocus.current = false;
    });
  };

  const handleFocus = (i: number) => {
    if (isProgFocus.current) return;
    const firstEmpty = digits.findIndex((d) => d === "");
    const target = firstEmpty === -1 ? 3 : firstEmpty;
    if (target !== i) focus(target);
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
    } else if (e.key === "ArrowRight" && i < 3) {
      e.preventDefault();
      focus(i + 1);
    }
  };

  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) return;

    if (raw.length > 1) {
      const pasted = raw.slice(0, 4);
      const next = Array.from({ length: 4 }, (_, idx) => pasted[idx] ?? "");
      onChange(next.join("").trimEnd());
      focus(Math.min(pasted.length, 3));
      return;
    }

    const next = [...digits];
    next[i] = raw[0];
    onChange(next.join("").trimEnd());
    if (i < 3) focus(i + 1);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 4);
    if (pasted) {
      const next = Array.from({ length: 4 }, (_, i) => pasted[i] ?? "");
      onChange(next.join("").trimEnd());
      focus(Math.min(pasted.length, 3));
      e.preventDefault();
    }
  };

  return (
    <div className="flex gap-4 justify-center">
      {Array.from({ length: 4 }).map((_, i) => {
        const filled = !!digits[i];
        const isActive =
          !disabled && (value.length === 4 ? i === 3 : i === value.length);
        return (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type={masked ? "password" : "text"}
            inputMode="numeric"
            maxLength={1}
            value={digits[i]}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKey(i, e)}
            onPaste={handlePaste}
            onFocus={() => handleFocus(i)}
            disabled={disabled}
            className="w-16 h-16 rounded-2xl text-center text-2xl font-bold outline-none transition-all select-none"
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
              boxShadow: isActive ? "0 0 0 4px rgba(249,115,22,0.12)" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

// ─── PIN strength indicator ───────────────────────────────────────────────────

function PinStrengthHint({ pin }: { pin: string }) {
  if (pin.length < 4) return null;

  const digits = pin.split("").map(Number);

  const isSequential =
    (digits[1] === digits[0] + 1 &&
      digits[2] === digits[1] + 1 &&
      digits[3] === digits[2] + 1) ||
    (digits[1] === digits[0] - 1 &&
      digits[2] === digits[1] - 1 &&
      digits[3] === digits[2] - 1);

  const isRepeating = digits.every((d) => d === digits[0]);

  const COMMON = [
    "1234",
    "0000",
    "1111",
    "2222",
    "3333",
    "4444",
    "5555",
    "6666",
    "7777",
    "8888",
    "9999",
    "1212",
    "1122",
    "0123",
    "9876",
  ];
  const isCommon = COMMON.includes(pin);

  if (isRepeating || isCommon || isSequential) {
    return (
      <div
        className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs mt-2"
        style={{
          background: "#FEF3C7",
          border: "1px solid #FDE68A",
          color: "#92400E",
        }}
      >
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span>
          {isRepeating
            ? "Avoid repeating digits like 0000."
            : isSequential
              ? "Avoid sequences like 1234."
              : "This is a commonly used PIN. Choose something less predictable."}
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs mt-2"
      style={{
        background: "#F0FDF4",
        border: "1px solid #BBF7D0",
        color: "#166534",
      }}
    >
      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
      <span>Looks good — not a common PIN.</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Step = "create" | "confirm";

export default function SetPinPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("create");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [masked, setMasked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Use a ref to hold the latest pin/confirmPin so the submit handler
  // is never stale regardless of when the effect fires
  const pinRef = useRef(pin);
  const confirmPinRef = useRef(confirmPin);
  pinRef.current = pin;
  confirmPinRef.current = confirmPin;

  // Auto-advance from create → confirm when 4 digits entered
  useEffect(() => {
    if (step === "create" && pin.length === 4) {
      const t = setTimeout(() => setStep("confirm"), 300);
      return () => clearTimeout(t);
    }
  }, [pin, step]);

  const handleSubmit = useCallback(async () => {
    // Always read from refs so values are fresh
    const currentPin = pinRef.current;
    const currentConfirm = confirmPinRef.current;

    if (currentConfirm.length < 4) return;

    if (currentPin !== currentConfirm) {
      setError("PINs don't match. Try again.");
      setConfirmPin("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: currentPin }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to set PIN");

      setSuccess(true);

      // Determine where to redirect — honour the ?next= param if present
      const nextPath =
        typeof window !== "undefined"
          ? (new URLSearchParams(window.location.search).get("next") ??
            "/dashboard")
          : "/dashboard";

      setTimeout(() => router.push(nextPath), 1800);
    } catch (e: any) {
      setError(e.message);
      setConfirmPin("");
      setStep("create");
      setPin("");
    } finally {
      setLoading(false);
    }
    // router is stable; no other deps needed because we read from refs
  }, [router]);

  // Auto-submit when confirm PIN reaches 4 digits
  useEffect(() => {
    if (step === "confirm" && confirmPin.length === 4 && !loading && !success) {
      handleSubmit();
    }
  }, [confirmPin, step, loading, success, handleSubmit]);

  const handleBack = () => {
    setStep("create");
    setConfirmPin("");
    setError("");
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#F9FAFB" }}
      >
        <div className="text-center max-w-sm mx-auto px-6">
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
            PIN is set! 🔐
          </h2>
          <p style={{ color: "#6B7280" }}>
            Your account is fully secured. Taking you to your dashboard…
          </p>
          <div
            className="flex items-center justify-center gap-2 text-sm mt-6"
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

        <div className="relative z-10 space-y-8">
          <div>
            <p
              className="text-sm font-semibold tracking-widest uppercase mb-4"
              style={{ color: "#F97316" }}
            >
              Almost there
            </p>
            <h1
              className="text-5xl font-black leading-tight mb-5"
              style={{ color: "#fff", letterSpacing: "-0.03em" }}
            >
              Secure your
              <br />
              <span style={{ color: "#F97316" }}>account.</span>
            </h1>
            <p
              className="text-lg leading-relaxed"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Your transaction PIN protects every payment you make. It's
              different from your password — only you know it.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                emoji: "🔐",
                title: "Required for every debit",
                desc: "Airtime, data, bills — all need your PIN to go through.",
              },
              {
                emoji: "🚫",
                title: "Never stored in plain text",
                desc: "We hash your PIN with bcrypt. Even we can't read it.",
              },
              {
                emoji: "🔁",
                title: "Reset anytime via OTP",
                desc: "Forgot it? You can reset with an email code at any time.",
              },
            ].map(({ emoji, title, desc }) => (
              <div
                key={title}
                className="flex items-start gap-4 rounded-2xl p-4"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span className="text-xl mt-0.5">{emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            © 2025 VendPro · Secured by Flutterwave · Nigerian-owned
          </p>
        </div>
      </div>

      {/* ── Right: PIN form ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-16 xl:px-20">
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
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-md"
            style={{
              background:
                step === "confirm"
                  ? "linear-gradient(135deg, #F0FDF4, #DCFCE7)"
                  : "linear-gradient(135deg, #FFF7ED, #FFEDD5)",
              border: `1.5px solid ${step === "confirm" ? "#86EFAC" : "#FDBA74"}`,
            }}
          >
            {step === "confirm" ? (
              <CheckCircle2 className="w-7 h-7" style={{ color: "#22C55E" }} />
            ) : (
              <Lock className="w-7 h-7" style={{ color: "#F97316" }} />
            )}
          </div>

          <div className="mb-8">
            <h2
              className="text-3xl font-black mb-1.5"
              style={{ color: "#111827", letterSpacing: "-0.02em" }}
            >
              {step === "create"
                ? "Set your transaction PIN"
                : "Confirm your PIN"}
            </h2>
            <p style={{ color: "#6B7280" }}>
              {step === "create"
                ? "Choose a 4-digit PIN. You'll need it to approve any payment."
                : "Enter the same 4-digit PIN again to confirm."}
            </p>
          </div>

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
                <p className="font-semibold">
                  {error.includes("match")
                    ? "PINs don't match"
                    : "Could not set PIN"}
                </p>
                <p className="text-xs mt-0.5 opacity-80">{error}</p>
              </div>
            </div>
          )}

          <div className="mb-4">
            {step === "create" ? (
              <>
                <PinInput
                  value={pin}
                  onChange={(v) => {
                    setPin(v);
                    setError("");
                  }}
                  disabled={loading}
                  hasError={!!error}
                  masked={masked}
                />
                <PinStrengthHint pin={pin} />
              </>
            ) : (
              <PinInput
                value={confirmPin}
                onChange={(v) => {
                  setConfirmPin(v);
                  setError("");
                }}
                disabled={loading}
                hasError={!!error}
                masked={masked}
              />
            )}
          </div>

          <div className="flex justify-center mb-6">
            <button
              type="button"
              onClick={() => setMasked((m) => !m)}
              className="flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: "#9CA3AF" }}
            >
              {masked ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
              {masked ? "Show digits" : "Hide digits"}
            </button>
          </div>

          {step === "create" ? (
            <button
              onClick={() => pin.length === 4 && setStep("confirm")}
              disabled={pin.length < 4 || loading}
              className="w-full py-4 rounded-2xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #F97316, #EA580C)",
              }}
            >
              Continue →
            </button>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleSubmit}
                disabled={confirmPin.length < 4 || loading}
                className="w-full py-4 rounded-2xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #F97316, #EA580C)",
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Setting PIN…
                  </span>
                ) : (
                  "Set my PIN →"
                )}
              </button>
              <button
                onClick={handleBack}
                disabled={loading}
                className="w-full py-3 rounded-2xl font-semibold text-sm transition-all hover:bg-gray-100 disabled:opacity-50"
                style={{
                  color: "#6B7280",
                  background: "transparent",
                  border: "1.5px solid #E5E7EB",
                }}
              >
                ← Go back and change PIN
              </button>
            </div>
          )}

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
                { label: "Verify email", done: true },
                { label: "Set PIN", done: false, active: true },
                { label: "Fund wallet", done: false },
              ].map((s, i) => (
                <React.Fragment key={s.label}>
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                      style={{
                        background: s.done
                          ? "#22C55E"
                          : s.active
                            ? "#F97316"
                            : "#E5E7EB",
                        color: s.done || s.active ? "#fff" : "#9CA3AF",
                      }}
                    >
                      {s.done ? "✓" : i + 1}
                    </div>
                    <span
                      className="text-xs text-center leading-tight"
                      style={{
                        color: s.done
                          ? "#22C55E"
                          : s.active
                            ? "#F97316"
                            : "#9CA3AF",
                        fontWeight: s.active ? 600 : 400,
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < 3 && (
                    <div
                      className="flex-1 h-px mt-[-14px] mx-1"
                      style={{ background: i < 2 ? "#22C55E" : "#E5E7EB" }}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: "#9CA3AF" }}>
            Want to set it later?{" "}
            <button
              onClick={() => router.push("/dashboard")}
              className="underline transition-colors"
              style={{ color: "#6B7280" }}
            >
              Skip for now
            </button>{" "}
            — you won't be able to make payments until it's set.
          </p>
        </div>
      </div>
    </div>
  );
}
