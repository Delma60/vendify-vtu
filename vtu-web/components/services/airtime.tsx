'use client'
import { Network } from "@/types"

import React, { useState, useEffect } from "react";
import { detectNetwork, NigerianNetwork } from "@/lib/airtime/utils";
// import { detectNetwork, NigerianNetwork } from "@/lib/airtime/engine";
import {
  Phone,
  Nfc,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

const QUICK_AMOUNTS = [100, 200, 500, 1000];


export function AirtimeFormContent({ networks }: { networks:Network[] }) {
     {
  const [step, setStep] = useState<"form" | "confirm" | "status">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState<NigerianNetwork | null>(null);
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");

  // Transaction State
  const [feeDetails, setFeeDetails] = useState<any>(null);
  const [txResult, setTxResult] = useState<any>(null);

  // Auto-detect network when phone number changes
  useEffect(() => {
    if (phone.length >= 4) {
      const detected = detectNetwork(phone);
      if (detected) setNetwork(detected);
    }
  }, [phone]);

  // Step 1: Preview transaction (Fetch fees)
  const handleContinue = async () => {
    setError(null);
    setLoading(true);
    try {
      const amountKobo = Number(amount) * 100;
      const res = await fetch(
        `/api/v1/airtime?amount=${amountKobo}&network=${network}`,
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to calculate fees");

      setFeeDetails(data.data);
      setStep("confirm");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Final Purchase
  const handlePurchase = async () => {
    setError(null);
    setLoading(true);
    try {
      const idempotencyKey = crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15);

      const res = await fetch("/api/v1/airtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          network,
          amount: Number(amount) * 100,
          transactionPin: pin,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transaction failed");

      setTxResult({ success: true, data: data.data });
      setStep("status");
    } catch (err: any) {
      setTxResult({ success: false, message: err.message });
      setStep("status");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPhone("");
    setAmount("");
    setPin("");
    setNetwork(null);
    setTxResult(null);
    setStep("form");
  };

  const isFormValid =
    phone.length >= 10 &&
    network &&
    Number(amount) >= 10 &&
    Number(amount) <= 100000;

  return (
    <div className="">
      {/* Only show Balance Card on the entry form */}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* --- STEP 1: FORM --- */}
        {step === "form" && (
          <div className="p-5 space-y-6">
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">
                Buy Airtime
              </h1>
              <p className="text-sm text-gray-500">
                Instant top-up to any network
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}

            {/* Network Selector */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700">
                Select Network
              </label>
              <div className="grid grid-cols-4 gap-3">
                {networks.map((net) => (
                  <button
                    key={net.id}
                    onClick={() => setNetwork(net?.id as any)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all active:scale-95 ${
                      network === net.code
                        ? "border-orange-500 bg-orange-50"
                        : "border-gray-100 bg-gray-50 hover:border-gray-200"
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full mb-1.5 flex items-center justify-center text-white font-bold text-xs"
                      style={{ backgroundColor: net.color }}
                    >
                      {net.name[0]}
                    </div>
                    <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wide">
                      {net.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Phone Input */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/[^0-9+]/g, ""))
                  }
                  className="block w-full pl-10 pr-3 py-3.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none text-base"
                  placeholder="080..."
                />
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <label className="text-sm font-semibold text-gray-700">
                  Amount (₦)
                </label>
                <span className="text-[10px] text-gray-400">
                  Min: ₦10 | Max: ₦100,000
                </span>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-gray-500 font-bold">₦</span>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="block w-full pl-9 pr-3 py-3.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none text-base font-bold"
                  placeholder="0.00"
                />
              </div>

              {/* Quick Amounts */}
              <div className="flex gap-2 pt-1 overflow-x-auto pb-1 hide-scrollbar">
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setAmount(amt.toString())}
                    className="whitespace-nowrap px-4 py-2 rounded-lg bg-orange-50 text-orange-600 border border-orange-100 text-sm font-semibold active:bg-orange-100 transition-colors"
                  >
                    ₦{amt}
                  </button>
                ))}
              </div>
            </div>

            <button
              disabled={!isFormValid || loading}
              onClick={handleContinue}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-xl font-bold text-base shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Continue"
              )}
              {!loading && <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        )}

        {/* --- STEP 2: CONFIRMATION --- */}
        {step === "confirm" && feeDetails && (
          <div className="p-5 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => setStep("form")}
                className="p-2 -ml-2 bg-gray-50 text-gray-600 rounded-full active:bg-gray-200 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">
                Confirm Payment
              </h1>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Network</span>
                <span className="font-bold text-gray-900 uppercase">
                  {network}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Phone</span>
                <span className="font-bold text-gray-900">{phone}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount</span>
                <span className="font-bold text-gray-900">
                  ₦{(feeDetails.amountKobo / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Service Fee</span>
                <span className="font-bold text-gray-900">
                  ₦{(feeDetails.totalFeeKobo / 100).toFixed(2)}
                </span>
              </div>
              <div className="pt-3 mt-1 border-t border-gray-200 flex justify-between items-center">
                <span className="text-gray-700 font-bold">Total to Pay</span>
                <span className="font-extrabold text-orange-600 text-lg">
                  ₦{(feeDetails.totalChargeKobo / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Nfc className="w-4 h-4 text-gray-500" /> Transaction PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
                className="block w-full px-4 py-3.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 tracking-[0.5em] text-center text-xl font-bold focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none"
                placeholder="••••"
              />
            </div>

            <button
              disabled={pin.length !== 4 || loading}
              onClick={handlePurchase}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-4 rounded-xl font-bold text-base shadow-lg disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Pay Now"
              )}
            </button>
          </div>
        )}

        {/* --- STEP 3: STATUS --- */}
        {step === "status" && txResult && (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-5">
            {txResult.success ? (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-500 mb-2 shadow-inner shadow-green-200">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">
                    Top-up Successful!
                  </h2>
                  <p className="text-gray-500 text-sm">
                    ₦{amount} airtime has been sent to {phone}.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-2 shadow-inner shadow-red-200">
                  <XCircle className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">
                    Transaction Failed
                  </h2>
                  <p className="text-gray-500 text-sm px-4">
                    {txResult.message ||
                      "We could not complete your request at this time."}
                  </p>
                </div>
              </>
            )}

            <div className="w-full pt-6">
              <button
                onClick={resetForm}
                className="w-full bg-gray-100 text-gray-800 py-3.5 rounded-xl font-bold text-sm active:bg-gray-200 transition-colors"
              >
                {txResult.success ? "Buy More Airtime" : "Try Again"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

}