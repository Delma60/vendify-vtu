"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
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
import { DataPlan, Network, NetworkType, Role } from "@/types";
import { createDataPlan, updateDataPlan } from "@/lib/db/helpers";

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

// ─── ZOD VALIDATION SCHEMA ──────────────────────────────────────────────────
const planSchema = z.object({
  network: z.string().min(1, "Network is required"),
  planType:z.string(),
  name: z.string().min(1, "Plan name is required"),
  sizeValue: z.coerce
    .number({ message: "Invalid size" })
    .positive("Must be > 0"),
  sizeUnit: z.enum(["MB", "GB", "TB"]),
  validity: z.string().min(1, "Validity is required"),
  priceInNaira: z.coerce
    .number({ message: "Invalid price" })
    .nonnegative("Must be >= 0"),
  providerPlanId: z.string().min(1, "Provider Plan ID is required"),
  provider: z.object({
    id: z.string().min(1, "Provider is required"),
    costPrice: z.coerce
      .number({ message: "Invalid cost" })
      .nonnegative("Must be >= 0"),
  }),
});

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
      className="flex h-fit flex-col rounded-2xl bg-white"
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
      <div className="flex-1 space-y-4 p-5">{children}</div>
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

// Helper to show errors under inputs
function ErrorText({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1 text-[11px] font-semibold text-red-500">{error}</p>;
}

interface CreateProps {
  roles: Role[];
  networks: Network[];
  networkTypes: NetworkType[];
  providers: any[];
  plan?: DataPlan;
}

const PlanForm = ({
  networkTypes,
  networks,
  roles,
  providers,
  plan,
}: CreateProps) => {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Parse existing size (e.g., "500MB" -> "500" and "MB")
  const defaultSizeMatch = plan?.size?.match(/^(\d+(?:\.\d+)?)\s*(MB|GB|TB)$/i);
  const [sizeValue, setSizeValue] = useState(
    defaultSizeMatch ? defaultSizeMatch[1] : "",
  );
  const [sizeUnit, setSizeUnit] = useState(
    defaultSizeMatch ? defaultSizeMatch[2].toUpperCase() : "GB",
  );

  // General price handling
  const [priceInNaira, setPriceInNaira] = useState(
    plan?.priceInKobo ? String(plan.priceInKobo / 100) : "",
  );

  // Convert legacy plan.rolePrice safely to new object format { value, type }
  const initialRolePrice: Record<string, { value: string; type: string }> = {};
  if (plan?.rolePrice) {
    Object.keys(plan.rolePrice).forEach((roleId) => {
      const val = plan.rolePrice[roleId] as any;
      if (typeof val === "object" && val !== null) {
        initialRolePrice[roleId] = {
          value: val.value || "",
          type: val.type || "fixed",
        };
      } else {
        initialRolePrice[roleId] = { value: String(val), type: "fixed" };
      }
    });
  }

  // Form State initialized to DataPlan structure
  const [formData, setFormData] = useState<any>(
    plan ?? {
      network: networks[0]?.id || "",
      planType: networkTypes[0]?.id || "",
      
      name: "",
      validity: "30 Days",
      provider: {
        id: providers[0]?.id || "",
        costPrice: "",
      },
      providerPlanId: "",
      rolePrice: initialRolePrice,
      isActive: true,
    },
  );

  const handleRolePriceChange = (
    roleId: string,
    field: "value" | "type",
    val: string,
  ) => {
    setFormData((prev: any) => {
      const currentRoleSetting = prev.rolePrice?.[roleId] || {
        value: "",
        type: "fixed",
      };
      return {
        ...prev,
        rolePrice: {
          ...(prev.rolePrice || {}),
          [roleId]: {
            ...currentRoleSetting,
            [field]: val,
          },
        },
      };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrors({});

    // 1. Validate Form Data using Zod
    const validation = planSchema.safeParse({
      ...formData,
      sizeValue,
      sizeUnit,
      priceInNaira,
    });

    if (!validation.success) {
      const formattedErrors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        formattedErrors[issue.path.join(".")] = issue.message;
      });
      setErrors(formattedErrors);
      setIsSaving(false);
      return;
    }

    // 2. Format Data for Submission
    const validData = validation.data;
    const submissionParams: any = {
      ...formData,
      size: `${validData.sizeValue}${validData.sizeUnit}`,
      priceInKobo: Math.round(validData.priceInNaira * 100),
      provider: {
        id: validData.provider.id,
        costPrice: String(validData.provider.costPrice), // Keep as string or convert based on interface
      },
    };

    try {
      if (plan?.id) {
        await updateDataPlan(plan.id, submissionParams);
      } else {
        await createDataPlan(submissionParams);
      }

      setTimeout(() => {
        setIsSaving(false);
        router.push("/admin/services/airtime-data?tab=data-plans");
      }, 1000);
    } catch {
      alert("Error saving data plan. Please try again.");
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="mx-auto max-w-5xl space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/admin/services/airtime-data?tab=data-plans"
                className="flex h-8 w-8 items-center justify-center rounded-xl border transition hover:bg-gray-50"
                style={{ borderColor: B.border, color: B.textMuted }}
              >
                <ArrowLeft size={16} />
              </Link>
              <h1 className="text-xl font-extrabold" style={{ color: B.text }}>
                {plan ? "Edit Data Plan" : "Create Data Plan"}
              </h1>
            </div>
            <p className="mt-1 pl-11 text-sm" style={{ color: B.textMuted }}>
              Configure network settings, sizes, providers, and role-based
              pricing.
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
            <div className="flex gap-4">
              <div className="flex-1 space-y-1.5">
                <label
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: B.textMuted }}
                >
                  Select Network
                </label>
                <select
                  value={formData.network || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, network: e.target.value })
                  }
                  className="w-full rounded-xl border px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500/20"
                  style={{
                    borderColor: errors.network ? B.red : B.border,
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
                <ErrorText error={errors.network} />
              </div>

              <div className="flex-1 space-y-1.5">
                <label
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: B.textMuted }}
                >
                  Network Type
                </label>
                <select
                  value={formData.planType || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, planType: e.target.value })
                  }
                  className="w-full rounded-xl border px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500/20"
                  style={{
                    borderColor: errors.plan ? B.red : B.border,
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
                <ErrorText error={errors.planType} />
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: B.textMuted }}
              >
                Plan Name
              </label>
              <input
                type="text"
                value={formData.name || ""}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full rounded-xl border px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500/20"
                style={{
                  borderColor: errors.name ? B.red : B.border,
                  color: B.text,
                  background: B.surface,
                }}
                placeholder="e.g. 1GB SME"
              />
              <ErrorText error={errors.name} />
            </div>

            <div className="flex gap-4 pt-2">
              <div className="flex-[2] space-y-1.5">
                <label
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: B.textMuted }}
                >
                  Data Size
                </label>
                <div className="flex">
                  <input
                    type="number"
                    step="0.1"
                    value={sizeValue}
                    onChange={(e) => setSizeValue(e.target.value)}
                    className="w-full rounded-l-xl border border-r-0 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500/20"
                    style={{
                      borderColor: errors.sizeValue ? B.red : B.border,
                      color: B.text,
                      background: B.surface,
                    }}
                    placeholder="e.g. 500"
                  />
                  <select
                    value={sizeUnit}
                    onChange={(e) => setSizeUnit(e.target.value)}
                    className="rounded-r-xl border px-3 py-3 text-sm font-bold outline-none"
                    style={{
                      borderColor: errors.sizeValue ? B.red : B.border,
                      color: B.text,
                      background: B.surface,
                    }}
                  >
                    <option value="MB">MB</option>
                    <option value="GB">GB</option>
                    <option value="TB">TB</option>
                  </select>
                </div>
                <ErrorText error={errors.sizeValue} />
              </div>

              <div className="flex-[1.5] space-y-1.5">
                <label
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: B.textMuted }}
                >
                  Validity
                </label>
                <input
                  type="text"
                  value={formData.validity || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, validity: e.target.value })
                  }
                  className="w-full rounded-xl border px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500/20"
                  style={{
                    borderColor: errors.validity ? B.red : B.border,
                    color: B.text,
                    background: B.surface,
                  }}
                  placeholder="e.g. 30 Days"
                />
                <ErrorText error={errors.validity} />
              </div>
            </div>
          </Card>

          {/* ROW 1, COL 2: Discount per Role */}
          <Card title="Role-Based Pricing" icon={Percent}>
            <p className="mb-2 text-xs" style={{ color: B.textFaint }}>
              Set the specific discount or fixed price each user role will be
              charged. Leave blank to fallback to General Sell Price.
            </p>
            <div className="space-y-3">
              {roles.map((role) => {
                const roleSetting = formData.rolePrice?.[role.id] || {
                  value: "",
                  type: "fixed",
                };
                return (
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

                    <div className="flex w-44">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={roleSetting.value}
                        onChange={(e) =>
                          handleRolePriceChange(
                            role.id,
                            "value",
                            e.target.value,
                          )
                        }
                        className="w-full rounded-l-xl border border-r-0 px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500/20"
                        style={{
                          borderColor: B.border,
                          color: B.text,
                          background: B.surface,
                        }}
                        placeholder="0.00"
                      />
                      <select
                        value={roleSetting.type}
                        onChange={(e) =>
                          handleRolePriceChange(role.id, "type", e.target.value)
                        }
                        className="rounded-r-xl border px-2 py-2 text-sm font-bold outline-none"
                        style={{
                          borderColor: B.border,
                          color: B.text,
                          background: B.surface,
                        }}
                      >
                        <option value="fixed">₦</option>
                        <option value="percentage">%</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* ROW 2, COL 1: Provider Selection */}
          <Card title="Provider Routing & Cost" icon={Server}>
            <p className="mb-2 text-xs" style={{ color: B.textFaint }}>
              Select the upstream VTU provider and configure cost details.
            </p>
            <div className="space-y-1.5">
              <label
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: B.textMuted }}
              >
                Upstream Provider
              </label>
              <select
                value={formData.provider?.id || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    provider: { ...formData.provider, id: e.target.value },
                  })
                }
                className="w-full rounded-xl border px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500/20"
                style={{
                  borderColor: errors["provider.id"] ? B.red : B.border,
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
              <ErrorText error={errors["provider.id"]} />
            </div>

            <div className="space-y-1.5 pt-2">
              <label
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: B.textMuted }}
              >
                Provider Plan ID / Code
              </label>
              <input
                type="text"
                value={formData.providerPlanId || ""}
                onChange={(e) =>
                  setFormData({ ...formData, providerPlanId: e.target.value })
                }
                className="w-full rounded-xl border px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500/20"
                style={{
                  borderColor: errors.providerPlanId ? B.red : B.border,
                  color: B.text,
                  background: B.surface,
                }}
                placeholder="e.g. mtn-sme-1gb"
              />
              <ErrorText error={errors.providerPlanId} />
            </div>

            <div className="space-y-1.5 pt-2">
              <label
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: B.textMuted }}
              >
                Cost Price (₦)
              </label>
              <div className="relative">
                <span
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold"
                  style={{ color: B.textFaint }}
                >
                  ₦
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.provider?.costPrice || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      provider: {
                        ...formData.provider,
                        costPrice: e.target.value,
                      },
                    })
                  }
                  className="w-full rounded-xl border py-3 pl-8 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500/20"
                  style={{
                    borderColor: errors["provider.costPrice"]
                      ? B.red
                      : B.border,
                    color: B.text,
                    background: B.surface,
                  }}
                  placeholder="e.g. 230"
                />
              </div>
              <ErrorText error={errors["provider.costPrice"]} />
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
                  Enable or disable this data plan instantly.
                </p>
              </div>
              <Toggle
                checked={formData.isActive ?? true}
                onChange={(val) => setFormData({ ...formData, isActive: val })}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PlanForm;
