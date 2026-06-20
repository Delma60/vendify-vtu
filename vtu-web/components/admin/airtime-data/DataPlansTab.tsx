// vtu-web/components/admin/airtime-data/DataPlansTab.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, Database, Edit2, Trash2 } from "lucide-react";
import { updateDataPlan } from "@/lib/db/helpers";
import { Toggle } from "@/components/ui/toggle";
import { DataPlan, NetworkType } from "@/types";
import { B, NETWORK_FILTER_OPTIONS } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataCategory } from "@/types/airtime-data";

export function DataPlansTab({
  initialPlans = [],
}: {
  initialPlans?: DataPlan[];
}) {
  const [plans, setPlans] = useState<DataPlan[]>(initialPlans);
  const [networkFilter, setNetworkFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error" | "warn";
  } | null>(null);

  function showToast(
    msg: string,
    type: "success" | "error" | "warn" = "success",
  ) {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // The server already seeds `initialPlans` for first paint — only fall
  // back to a client fetch if that seed came back empty.
  useEffect(() => {
    if (initialPlans.length > 0) return;

    (async () => {
      const res = await fetch("/api/internal/data-plans");
      const _res = await res.json();
      setPlans(_res.data);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = plans?.filter((p) => {
    if (networkFilter !== "all" && p.network !== networkFilter) return false;
    if (catFilter !== "all" && p.planType !== catFilter) return false;
    if (
      search &&
      !`${p.plan.value ?? ""}${p.plan.unit ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      !p.size.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total plans",
            value: plans?.length,
            color: B.blue,
            bg: B.blueLight,
          },
          {
            label: "Active",
            value: plans?.filter((p) => p.isActive).length,
            color: B.green,
            bg: B.greenLight,
          },
          {
            label: "Margin issues",
            value: plans?.filter((p:any) => p?.costPriceKobo > p?.sellPriceKobo)
              .length,
            color: B.red,
            bg: B.redLight,
          },
          {
            label: "Networks covered",
            value: new Set(plans?.map((p) => p.network)).size,
            color: B.amber,
            bg: B.amberLight,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-4"
            style={{ background: s.bg, border: `1px solid ${s.color}20` }}
          >
            <p className="text-xl font-extrabold" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="text-xs font-semibold" style={{ color: s.color }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex flex-1 items-center gap-2 rounded-xl border px-3 py-2"
          style={{ borderColor: B.border, minWidth: 160 }}
        >
          <Search size={14} style={{ color: B.textFaint }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plans…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: B.text }}
          />
        </div>
        <select
          value={networkFilter}
          onChange={(e) => setNetworkFilter(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: B.border, color: B.text }}
        >
          {NETWORK_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="rounded-xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: B.border, color: B.text }}
        >
          <option value="all">All categories</option>
          {(["SME", "Gifting", "Corporate", "Direct"] as DataCategory[]).map(
            (c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ),
          )}
        </select>
        <Link
          href="/admin/services/airtime-data/data-plans/new"
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
          style={{
            background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
          }}
        >
          <Plus size={14} />
          Add plan
        </Link>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {filtered?.length === 0 ? (
          <EmptyState
            icon={Database}
            title="No data plans found"
            description="Try adjusting filters or add a new plan."
            action={{
                label: 'Add new',
                onClick() {
                    location.href = "/admin/services/airtime-data/data-plans/new"
                },
            }}
            // addLink="/admin/services/airtime-data/data-plans/new"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                  {[
                    "Network|Data Type",
                    "Plan|Validity",
                    "Cost",
                    "Status",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide"
                      style={{ color: B.textFaint }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: B.border }}>
                {filtered?.map((plan) => (
                  <tr
                    key={plan?.id}
                    className="group hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 space-y-1 ">
                      {/* <NetworkBadge code={plan?.network} /> */}
                      {plan?.network}|
                      {(plan?.planType as NetworkType)?.name}
                    </td>

                    <td
                      className="px-4 py-3 text-sm font-bold"
                      style={{ color: B.orange }}
                    >
                      {plan?.plan?.value || ""}
                      {plan?.plan?.unit || ""}|{plan?.validity}
                    </td>
                    <td
                      className="px-4 py-3 text-xs"
                      style={{ color: B.textMuted }}
                    >
                      ₦{plan?.provider?.costPrice}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge active={plan?.isActive} />
                        <Toggle
                          checked={plan?.isActive}
                          onChange={(v) => {
                            updateDataPlan(plan?.id as string, {
                              isActive: v,
                            }).then(() => {
                              setPlans((prev) =>
                                prev.map((p) =>
                                  p.id === plan?.id ? { ...p, isActive: v } : p,
                                ),
                              );
                              showToast(`Plan ${v ? "enabled" : "disabled"}.`);
                            });
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/services/airtime-data/data-plans/${plan?.id}`}
                        className="inline-flex rounded-lg p-1.5 transition hover:bg-gray-200"
                        style={{ color: B.textFaint }}
                      >
                        <Edit2 size={13} />
                      </Link>

                      <button className="inline-flex rounded-lg p-1.5 text-red-600 hover:text-red-800 transition hover:bg-red-200">
                        <Trash2 size={13} className="" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
}