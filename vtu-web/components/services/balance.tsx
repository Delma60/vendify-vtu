// vtu-web/components/wallet/CompactBalanceCard.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Eye,
  EyeOff,
  Plus,
  Wallet,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

export default function BalanceCard() {
  const [isVisible, setIsVisible] = useState(true);
  const [balanceKobo, setBalanceKobo] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/balance");
      if (!res.ok) {
        if (res.status === 401) throw new Error("Session expired");
        throw new Error("Could not load balance");
      }
      const data = await res.json();
      if (data.success) {
        setBalanceKobo(data.data.balance);
      } else {
        throw new Error(data.error ?? "Failed to load balance");
      }
    } catch (err: any) {
      setError(err.message ?? "Failed to fetch balance");
      setBalanceKobo(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const formattedBalance =
    balanceKobo !== null
      ? new Intl.NumberFormat("en-NG", {
          style: "currency",
          currency: "NGN",
          minimumFractionDigits: 2,
        }).format(balanceKobo / 100)
      : "₦0.00";

  return (
    <div
      className="rounded-lg p-5 w-full shadow"
      style={{
        background: "#fff",
        border: "1.5px solid #E5E7EB",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5" style={{ color: "#9CA3AF" }}>
          <div
            className="flex items-center justify-center w-6 h-6 rounded-lg"
            style={{ background: "rgba(249,115,22,0.10)" }}
          >
            <Wallet className="w-3.5 h-3.5" style={{ color: "#F97316" }} />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider">
            Wallet Balance
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Refresh */}
          <button
            onClick={fetchBalance}
            disabled={isLoading}
            className="p-1 rounded-lg transition-colors disabled:opacity-40"
            style={{ color: "#9CA3AF" }}
            title="Refresh balance"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>

          {/* Show/hide toggle */}
          <button
            onClick={() => setIsVisible((v) => !v)}
            disabled={isLoading}
            className="p-1 rounded-lg transition-colors disabled:opacity-40"
            style={{ color: "#9CA3AF" }}
            title={isVisible ? "Hide balance" : "Show balance"}
          >
            {isVisible ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Balance display */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-9 flex items-center mb-1">
            {isLoading ? (
              <div
                className="h-7 w-36 rounded-lg animate-pulse"
                style={{ background: "#F3F4F6" }}
              />
            ) : error ? (
              <div
                className="flex items-center gap-1.5 text-xs"
                style={{ color: "#DC2626" }}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : (
              <h2
                className="text-2xl font-extrabold tracking-tight"
                style={{ color: "#111827" }}
              >
                {isVisible ? formattedBalance : "₦ ••••••"}
              </h2>
            )}
          </div>

          {/* Virtual account hint */}
          {!isLoading && !error && (
            <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>
              Available to spend
            </p>
          )}
        </div>

        {/* Fund Wallet CTA */}
        <div className="">
          <Link
            href="/wallet"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
            style={{
              background: "linear-gradient(135deg, #F97316, #EA580C)",
              boxShadow: "0 2px 10px rgba(249,115,22,0.25)",
              pointerEvents: isLoading ? "none" : "auto",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            <Plus className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
