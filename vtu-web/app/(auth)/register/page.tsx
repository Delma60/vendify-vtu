// vtu-web/app/(auth)/register/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  Zap,
  Wifi,
  Tv,
  Lightbulb,
} from "lucide-react";

const NETWORKS = [
  { label: "MTN", color: "#FBBF24" },
  { label: "Airtel", color: "#EF4444" },
  { label: "Glo", color: "#22C55E" },
  { label: "9Mobile", color: "#10B981" },
];

// ─── Hero card — animated top-up preview ─────────────────────────────────────
function TopUpPreviewCard() {
  const [activeService, setActiveService] = useState(0);
  const services = [
    {
      icon: <Zap className="w-4 h-4" />,
      label: "Airtime",
      value: "₦500",
      sub: "08012345678 · MTN",
    },
    {
      icon: <Wifi className="w-4 h-4" />,
      label: "Data",
      value: "1GB",
      sub: "08098765432 · Airtel",
    },
    {
      icon: <Lightbulb className="w-4 h-4" />,
      label: "Electricity",
      value: "₦2,000",
      sub: "Meter 45678901 · AEDC",
    },
    {
      icon: <Tv className="w-4 h-4" />,
      label: "Cable TV",
      value: "₦3,500",
      sub: "IUC 1234567890 · DStv",
    },
  ];
  const s = services[activeService];

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Glow */}
      <div
        className="absolute inset-0 rounded-3xl blur-2xl opacity-30"
        style={{ background: "linear-gradient(135deg, #F97316, #22C55E)" }}
      />

      <div
        className="relative rounded-3xl p-6 shadow-2xl"
        style={{
          background: "rgba(255,255,255,0.12)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.25)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "#F97316" }}
            >
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-sm tracking-tight">
              VendPro
            </span>
          </div>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "rgba(34,197,94,0.2)", color: "#86EFAC" }}
          >
            Wallet: ₦5,200
          </span>
        </div>

        {/* Service tabs */}
        <div className="flex gap-1.5 mb-5">
          {services.map((sv, i) => (
            <button
              key={i}
              onClick={() => setActiveService(i)}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background:
                  activeService === i
                    ? "rgba(249,115,22,0.9)"
                    : "rgba(255,255,255,0.1)",
                color: activeService === i ? "#fff" : "rgba(255,255,255,0.6)",
              }}
            >
              {sv.label}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div
          className="rounded-2xl p-4 mb-4"
          style={{ background: "rgba(0,0,0,0.2)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(249,115,22,0.3)", color: "#FED7AA" }}
            >
              {s.icon}
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none">
                {s.value}
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                {s.sub}
              </p>
            </div>
          </div>
          <div
            className="h-px mb-3"
            style={{ background: "rgba(255,255,255,0.1)" }}
          />
          <div
            className="flex justify-between text-xs"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            <span>Fee</span>
            <span className="text-white">₦0.00</span>
          </div>
        </div>

        <button
          className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
        >
          Send {s.value} →
        </button>

        {/* Bottom note */}
        <p
          className="text-center text-xs mt-3"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          Delivered in under 5 seconds. Always.
        </p>
      </div>

      {/* Floating badges */}
      <div
        className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg"
        style={{ background: "#22C55E", color: "#fff" }}
      >
        ✓ Instant
      </div>
      <div
        className="absolute -bottom-3 -left-3 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg"
        style={{
          background: "#1E293B",
          color: "rgba(255,255,255,0.8)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        🔒 Secure & encrypted
      </div>
    </div>
  );
}

// ─── Register form ────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    phone: "",
    password: "",
    referralCode: "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const { data } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      setSuccess(true);
      sessionStorage.setItem("pending_uid", data.uid);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };

  const strength = passwordStrength(form.password);
  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthColors = ["", "#EF4444", "#F97316", "#EAB308", "#22C55E"];

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#F9FAFB" }}
      >
        <div className="text-center max-w-sm mx-auto px-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg"
            style={{ background: "#22C55E" }}
          >
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: "#111827" }}>
            You're in!
          </h2>
          <p className="mb-6" style={{ color: "#6B7280" }}>
            Check your inbox — we sent a 6-digit code to{" "}
            <strong style={{ color: "#111827" }}>{form.email}</strong> to verify
            your account.
          </p>
          <Link
            href="/verify-email"
            className="inline-block w-full py-3.5 rounded-2xl font-bold text-white text-center transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
          >
            Enter verification code
          </Link>
          <p className="mt-4 text-sm" style={{ color: "#9CA3AF" }}>
            Already verified?{" "}
            <Link
              href="/login"
              className="font-semibold"
              style={{ color: "#F97316" }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#F9FAFB" }}>
      {/* ── Left: hero panel ──────────────────────────────────────────────────── */}
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

        {/* Middle content */}
        <div className="relative z-10 flex flex-col gap-10">
          <div>
            <p
              className="text-sm font-semibold tracking-widest uppercase mb-4"
              style={{ color: "#F97316" }}
            >
              Nigeria's fastest VTU platform
            </p>
            <h1
              className="text-5xl font-black leading-tight mb-5"
              style={{ color: "#fff", letterSpacing: "-0.03em" }}
            >
              Top up. Pay bills.
              <br />
              <span style={{ color: "#F97316" }}>Done in seconds.</span>
            </h1>
            <p
              className="text-lg leading-relaxed"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Airtime, data, electricity, cable — all in one wallet. No stress,
              no queues. Just tap and go.
            </p>
          </div>

          <TopUpPreviewCard />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: "2M+", label: "Transactions" },
              { value: "₦0", label: "Hidden fees" },
              { value: "<5s", label: "Average delivery" },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="rounded-2xl p-4"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p className="text-2xl font-black text-white">{value}</p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            © 2025 VendPro · Secured by Flutterwave · Nigerian-owned
          </p>
        </div>
      </div>

      {/* ── Right: form panel ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-16 xl:px-20 overflow-y-auto">
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
          {/* Heading */}
          <div className="mb-8">
            <h2
              className="text-3xl font-black mb-1.5"
              style={{ color: "#111827", letterSpacing: "-0.02em" }}
            >
              Create your account
            </h2>
            <p style={{ color: "#6B7280" }}>
              Free to join. Takes under a minute.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-3 rounded-2xl px-4 py-3.5 mb-6 text-sm"
              style={{
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#DC2626",
              }}
            >
              <span className="mt-0.5">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label
                className="block text-sm font-semibold mb-1.5"
                style={{ color: "#374151" }}
              >
                Username
              </label>
              <input
                type="text"
                required
                placeholder="chidi_121"
                name="displayName"
                value={form.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                className="w-full rounded-2xl px-4 py-3.5 text-sm outline-none transition-all"
                style={{
                  background: "#fff",
                  border: "1.5px solid #E5E7EB",
                  color: "#111827",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#F97316")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              />
            </div>

            {/* Email */}
            <div>
              <label
                className="block text-sm font-semibold mb-1.5"
                style={{ color: "#374151" }}
              >
                Email address
              </label>
              <input
                type="email"
                required
                placeholder="chidi@gmail.com"
                name="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="w-full rounded-2xl px-4 py-3.5 text-sm outline-none transition-all"
                style={{
                  background: "#fff",
                  border: "1.5px solid #E5E7EB",
                  color: "#111827",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#F97316")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              />
            </div>

            {/* Phone */}
            <div>
              <label
                className="block text-sm font-semibold mb-1.5"
                style={{ color: "#374151" }}
              >
                Phone number
              </label>
              <div className="relative">
                <span
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold select-none"
                  style={{ color: "#9CA3AF" }}
                >
                  +234
                </span>
                <input
                  type="tel"
                  required
                  placeholder="8012345678"
                  autoComplete="tel-national"
                  name="phone"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className="w-full rounded-2xl pl-14 pr-4 py-3.5 text-sm outline-none transition-all"
                  style={{
                    background: "#fff",
                    border: "1.5px solid #E5E7EB",
                    color: "#111827",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#F97316")}
                  onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                className="block text-sm font-semibold mb-1.5"
                style={{ color: "#374151" }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  className="w-full rounded-2xl px-4 pr-12 py-3.5 text-sm outline-none transition-all"
                  style={{
                    background: "#fff",
                    border: "1.5px solid #E5E7EB",
                    color: "#111827",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#F97316")}
                  onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "#9CA3AF" }}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Strength bar */}
              {form.password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="flex-1 h-1 rounded-full transition-all"
                        style={{
                          background:
                            i <= strength
                              ? strengthColors[strength]
                              : "#E5E7EB",
                        }}
                      />
                    ))}
                  </div>
                  {strength > 0 && (
                    <p
                      className="text-xs font-medium"
                      style={{ color: strengthColors[strength] }}
                    >
                      {strengthLabels[strength]} password
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Referral code (optional) */}
            <div>
              <label
                className="block text-sm font-semibold mb-1.5"
                style={{ color: "#374151" }}
              >
                Referral code{" "}
                <span className="font-normal" style={{ color: "#9CA3AF" }}>
                  (optional)
                </span>
              </label>
              <input
                type="text"
                placeholder="e.g. ABCD1234"
                value={form.referralCode}
                onChange={(e) =>
                  set("referralCode", e.target.value.toUpperCase())
                }
                className="w-full rounded-2xl px-4 py-3.5 text-sm outline-none transition-all uppercase tracking-widest"
                style={{
                  background: "#fff",
                  border: "1.5px solid #E5E7EB",
                  color: "#111827",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#F97316")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              />
            </div>

            {/* Networks */}
            <div
              className="flex items-center justify-between rounded-2xl px-4 py-3"
              style={{ background: "#F9FAFB", border: "1.5px solid #E5E7EB" }}
            >
              <span
                className="text-xs font-medium"
                style={{ color: "#6B7280" }}
              >
                Works with all networks
              </span>
              <div className="flex gap-2 items-center">
                {NETWORKS.map((n) => (
                  <span
                    key={n.label}
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: n.color + "22", color: n.color }}
                  >
                    {n.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-60 mt-2"
              style={{
                background: "linear-gradient(135deg, #F97316, #EA580C)",
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating your account…
                </span>
              ) : (
                "Create account — it's free"
              )}
            </button>
          </form>

          {/* Sign in link */}
          <p className="text-center text-sm mt-6" style={{ color: "#6B7280" }}>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold transition-colors"
              style={{ color: "#F97316" }}
            >
              Sign in
            </Link>
          </p>

          {/* Legal */}
          <p className="text-center text-xs mt-4" style={{ color: "#9CA3AF" }}>
            By creating an account you agree to our{" "}
            <Link
              href="/terms"
              className="underline"
              style={{ color: "#6B7280" }}
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="underline"
              style={{ color: "#6B7280" }}
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
