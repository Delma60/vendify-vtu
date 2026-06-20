// vtu-web/components/admin/airtime-data/AirtimeDataTabs.tsx
"use client";

import React, { useState } from "react";
import {
  Smartphone,
  Percent,
  Package,
  Key,
  Network as NetworkIcon,
  Shield,
} from "lucide-react";
import type { AirtimeTypeConfig, DataPlan, Network } from "@/types";
import { NetworksTab } from "./NetworksTab";
import { NetworkTypesTab } from "./NetworkTypesTab";
import { AirtimeDiscountsTab } from "./AirtimeDiscountsTab";
import { DataPlansTab } from "./DataPlansTab";
import { PinTab } from "./PinTab";
import { TabId } from "@/types/airtime-data";
import { B } from "@/lib/utils";

const TABS: {
  id: TabId;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    id: "networks",
    label: "Networks",
    icon: NetworkIcon,
    description: "Manage MTN, Airtel, Glo, 9mobile network configs",
  },
  {
    id: "network-types",
    label: "Network types",
    icon: Smartphone,
    description: "VTU, SNS, SME, Share & Sell type configs",
  },
  {
    id: "airtime-discounts",
    label: "Airtime discounts",
    icon: Percent,
    description: "Per-network, per-type discount rates",
  },
  {
    id: "data-plans",
    label: "Data plans",
    icon: Package,
    description: "All data bundles with pricing and margins",
  },
  {
    id: "airtime-pin",
    label: "Airtime PINs",
    icon: Key,
    description: "Balance check PINs for airtime",
  },
  {
    id: "data-pin",
    label: "Data PINs",
    icon: Shield,
    description: "Balance check codes for data",
  },
];

interface AirtimeDataTabsProps {
  initialNetworks?: Network[];
  initialNetworkTypes?: AirtimeTypeConfig[];
  initialDataPlans?: DataPlan[];
}

export function AirtimeDataTabs({
  initialNetworks = [],
  initialNetworkTypes = [],
  initialDataPlans = [],
}: AirtimeDataTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("networks");

  const activeTabMeta = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="space-y-4">
      {/* Tab nav — horizontal scroll on mobile */}
      <div
        className="flex gap-1 overflow-x-auto rounded-2xl p-1"
        style={{ background: B.surface, border: `1px solid ${B.border}` }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all"
              style={{
                background: active
                  ? "linear-gradient(135deg, #F97316, #EA580C)"
                  : "transparent",
                color: active ? "#fff" : B.textMuted,
                boxShadow: active ? "0 2px 10px rgba(249,115,22,0.2)" : "none",
              }}
            >
              <Icon size={14} strokeWidth={2} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active tab label */}
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{
          background: B.orangeLight,
          border: `1px solid rgba(249,115,22,0.15)`,
        }}
      >
        <activeTabMeta.icon size={16} style={{ color: B.orange }} />
        <div>
          <p className="text-sm font-bold" style={{ color: B.orange }}>
            {activeTabMeta.label}
          </p>
          <p className="text-xs" style={{ color: "#C2410C" }}>
            {activeTabMeta.description}
          </p>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "networks" && (
        <NetworksTab initialNetworks={initialNetworks} />
      )}
      {activeTab === "network-types" && (
        <NetworkTypesTab initialItems={initialNetworkTypes} />
      )}
      {activeTab === "airtime-discounts" && <AirtimeDiscountsTab />}
      {activeTab === "data-plans" && (
        <DataPlansTab initialPlans={initialDataPlans} />
      )}
      {activeTab === "airtime-pin" && <PinTab type="airtime" />}
      {activeTab === "data-pin" && <PinTab type="data" />}
    </div>
  );
}