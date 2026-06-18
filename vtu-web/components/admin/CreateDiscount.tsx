"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Globe,
  Percent,
  Server,
  Settings,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from "lucide-react";
import { Network, NetworkType, Role } from "@/types";
import { AirtimeDiscount, createAirtimeDiscount, updateAirtimeDiscount } from "@/lib/db/helpers";

const B = {
  orange: "#F97316",
  orangeDark: "#EA580C",
  orangeLight: "rgba(249,115,22,0.10)",
  green: "#22C55E",
  red: "#EF4444",
  text: "#111827",
  textMuted: "#6B7280",
  textFaint: "#9CA3AF",
  border: "#E5E7EB",
  surface: "#F9FAFB",
};

function Card({
  children,
  title,
  icon: Icon,
}: {
  children: React.ReactNode;
  title: string;
  icon: React.ElementType;
}) {
  return (
    <div
      className="flex flex-col rounded-2xl bg-white"
      style={{ border: `1px solid ${B.border}` }}
    >
      <div
        className="flex items-center gap-3 border-b px-5 py-4"
        style={{ borderColor: B.border }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: B.orangeLight }}
        >
          <Icon size={16} style={{ color: B.orange }} />
        </div>
        <h2 className="text-base font-bold" style={{ color: B.text }}>
          {title}
        </h2>
      </div>
      <div className="p-5 flex-1 space-y-4">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center transition-all active:scale-95"
    >
      {checked ? (
        <ToggleRight size={32} style={{ color: B.green }} strokeWidth={2} />
      ) : (
        <ToggleLeft size={32} style={{ color: B.textFaint }} strokeWidth={2} />
      )}
    </button>
  );
}

interface CreateDiscountProps {
  roles: Role[];
  networks: Network[];
  networkTypes: NetworkType[];
  providers: any[];
  discount?:AirtimeDiscount|null
}

const DiscountForm = ({
  networkTypes,
  networks,
  roles,
  providers,
  discount
}: CreateDiscountProps) => {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState(discount ?? {
    network: "mtn",
    type: "VTU",
    provider: "vtpass",
    isActive: true,
    minAmount: "50",
    maxAmount: "5000",
    roleDiscounts: {
      customer: "2.0",
      agent: "2.5",
      reseller: "3.0",
      api: "3.5",
    } as Record<string, string>,
  });

  const handleRoleDiscountChange = (roleId: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      roleDiscounts: {
        ...prev.roleDiscounts,
        [roleId]: value,
      },
    }));
  };

  useEffect(() => {
    (async () => {})();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try{
      const params = {
          network: formData.network,
          type: formData.type,
          provider: formData.provider,
          isActive: formData.isActive,
          minAmountKobo: parseFloat(formData.minAmount) * 100,
          maxAmountKobo: parseFloat(formData.maxAmount) * 100,
          roleDiscounts: Object.fromEntries(
            Object.entries(formData.roleDiscounts).map(([key, value]) => [key, parseFloat(value)])
          ),
        }
      if(discount){
        await createAirtimeDiscount(params);
      }else{
        await updateAirtimeDiscount(discount?.id, params)
      }
  
      setTimeout(() => {
        setIsSaving(false);
        router.push("/admin/services/airtime-data?tab=airtime-discounts");
      }, 1000);
    }
    catch{
      alert("error")
    }
    // TODO: Wire this up to the createAirtimeDiscount helper
  };
  return (
    <div>
      <div className="mx-auto max-w-5xl space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/admin/services/airtime-data?tab=airtime-discounts"
                className="flex h-8 w-8 items-center justify-center rounded-xl border transition hover:bg-gray-50"
                style={{ borderColor: B.border, color: B.textMuted }}
              >
                <ArrowLeft size={16} />
              </Link>
              <h1 className="text-xl font-extrabold" style={{ color: B.text }}>
                Create Airtime Discount
              </h1>
            </div>
            <p className="mt-1 pl-11 text-sm" style={{ color: B.textMuted }}>
              Configure network settings, providers, and role-based pricing.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-70"
            style={{
              background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
            }}
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {isSaving ? "Saving..." : "Save Configuration"}
          </button>
        </div>

        {/* Grid Layout (2 Rows, 2 Columns) */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* ROW 1, COL 1: General Info */}
          <Card title="General Details" icon={Globe}>
            <div className="space-y-1.5">
              <label
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: B.textMuted }}
              >
                Select Network
              </label>
              <select
                value={formData.network}
                onChange={(e) =>
                  setFormData({ ...formData, network: e.target.value })
                }
                className="w-full rounded-xl border px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500/20"
                style={{
                  borderColor: B.border,
                  color: B.text,
                  background: B.surface,
                }}
              >
                {networks.map((net) => (
                  <option key={net.id} value={net.id}>
                    {net.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 pt-2">
              <label
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: B.textMuted }}
              >
                Network Type
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                className="w-full rounded-xl border px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500/20"
                style={{
                  borderColor: B.border,
                  color: B.text,
                  background: B.surface,
                }}
              >
                {networkTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          {/* ROW 1, COL 2: Discount per Role */}
          <Card title="Role-Based Discounts" icon={Percent}>
            <p className="mb-2 text-xs" style={{ color: B.textFaint }}>
              Set the percentage discount each user role will receive for this
              configuration.
            </p>
            <div className="space-y-3">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center justify-between gap-4"
                >
                  <label
                    className="text-sm font-semibold"
                    style={{ color: B.text }}
                  >
                    {role.name}
                  </label>
                  <div className="relative w-32">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.roleDiscounts[role.id]}
                      onChange={(e) =>
                        handleRoleDiscountChange(role.id, e.target.value)
                      }
                      className="w-full rounded-xl border py-2 pl-4 pr-8 text-right text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500/20"
                      style={{
                        borderColor: B.border,
                        color: B.text,
                        background: B.surface,
                      }}
                    />
                    <span
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold"
                      style={{ color: B.textFaint }}
                    >
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* ROW 2, COL 1: Provider Selection */}
          <Card title="Provider Routing" icon={Server}>
            <p className="mb-2 text-xs" style={{ color: B.textFaint }}>
              Select the upstream VTU provider that will fulfill this specific
              airtime configuration.
            </p>
            <div className="space-y-1.5">
              <label
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: B.textMuted }}
              >
                Upstream Provider
              </label>
              <select
                value={formData.provider}
                onChange={(e) =>
                  setFormData({ ...formData, provider: e.target.value })
                }
                className="w-full rounded-xl border px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500/20"
                style={{
                  borderColor: B.border,
                  color: B.text,
                  background: B.surface,
                }}
              >
                {providers.map((prov) => (
                  <option key={prov.id} value={prov.id}>
                    {prov.name}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          {/* ROW 2, COL 2: Settings */}
          <Card title="Configuration Settings" icon={Settings}>
            <div
              className="flex items-center justify-between rounded-xl border p-4"
              style={{ borderColor: B.border, background: B.surface }}
            >
              <div>
                <p className="text-sm font-bold" style={{ color: B.text }}>
                  Active Status
                </p>
                <p className="text-xs" style={{ color: B.textFaint }}>
                  Enable or disable this configuration instantly.
                </p>
              </div>
              <Toggle
                checked={formData.isActive}
                onChange={(val) => setFormData({ ...formData, isActive: val })}
              />
            </div>

            <div className="space-y-1.5 pt-2">
              <label
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: B.textMuted }}
              >
                Minimum Purchase Amount (₦)
              </label>
              <input
                type="number"
                value={formData.minAmount}
                onChange={(e) =>
                  setFormData({ ...formData, minAmount: e.target.value })
                }
                className="w-full rounded-xl border px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500/20"
                style={{
                  borderColor: B.border,
                  color: B.text,
                  background: B.surface,
                }}
                placeholder="e.g. 50"
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DiscountForm;
