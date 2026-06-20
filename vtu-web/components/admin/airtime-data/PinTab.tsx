// vtu-web/components/admin/airtime-data/PinTab.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Key, Plus, Eye, EyeOff, Copy, Check, Zap, Edit2 } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { PinConfig } from "@/types/airtime-data";
import { B, NETWORK_FILTER_OPTIONS } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

export function PinTab({ type }: { type: "airtime" | "data" }) {
  const [items, setItems] = useState<PinConfig[]>([]);
  const [networkFilter, setNetworkFilter] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showPin, setShowPin] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error" | "warn";
  } | null>(null);

  function showToast(msg: string, t: "success" | "error" | "warn" = "success") {
    setToast({ msg, type: t });
    setTimeout(() => setToast(null), 3000);
  }

  function copyPin(id: string, pin: string) {
    navigator.clipboard.writeText(pin).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast("Copied to clipboard!");
    });
  }

  const filtered = items?.filter((i) =>
    networkFilter === "all" ? true : i.network === networkFilter,
  );

  function toggleItem(id: string, val: boolean) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isActive: val } : i)),
    );
    showToast(`PIN config ${val ? "enabled" : "disabled"}.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
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
        <Link
          href={`/admin/services/airtime-data/pins/new?type=${type}`}
          className="ml-auto flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
          style={{
            background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
          }}
        >
          <Plus size={14} />
          Add {type} PIN
        </Link>
      </div>

      <Card className="overflow-hidden">
        {filtered?.length === 0 ? (
          <EmptyState
            icon={Key}
            title={`No ${type} PINs configured`}
            action={{
              label: "Add new",
              onClick() {
                location.href = `/admin/services/airtime-data/pins/new?type=${type}`;
              },
            }}
            // addLink={`/admin/services/airtime-data/pins/new?type=${type}`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px]">
              <thead>
                <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                  {["Network", "Label", "PIN / Code", "USSD", "Status", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide"
                        style={{ color: B.textFaint }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: B.border }}>
                {filtered?.map((item) => (
                  <tr
                    key={item.id}
                    className="group transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      {/* <NetworkBadge code={item.network} /> */}
                      {item.network}
                    </td>
                    <td className="px-4 py-3">
                      <p
                        className="text-sm font-bold"
                        style={{ color: B.text }}
                      >
                        {item.label}
                      </p>
                      {item.notes && (
                        <p
                          className="mt-0.5 text-xs"
                          style={{ color: B.textFaint }}
                        >
                          {item.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center gap-2 rounded-xl px-2 py-1.5"
                        style={{
                          background: B.surface,
                          border: `1px solid ${B.border}`,
                          width: "max-content",
                        }}
                      >
                        <Key
                          size={13}
                          style={{ color: B.orange }}
                          className="shrink-0"
                        />
                        <span
                          className="font-mono text-sm font-bold tracking-wider"
                          style={{ color: B.text }}
                        >
                          {showPin[item.id] ? item.pin : "••••••••"}
                        </span>
                        <button
                          onClick={() =>
                            setShowPin((s) => ({
                              ...s,
                              [item.id]: !s[item.id],
                            }))
                          }
                          className="rounded p-1"
                          style={{ color: B.textFaint }}
                        >
                          {showPin[item.id] ? (
                            <EyeOff size={13} />
                          ) : (
                            <Eye size={13} />
                          )}
                        </button>
                        <button
                          onClick={() => copyPin(item.id, item.pin)}
                          className="rounded p-1"
                          style={{
                            color: copiedId === item.id ? B.green : B.textFaint,
                          }}
                        >
                          {copiedId === item.id ? (
                            <Check size={13} />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                        style={{
                          background: B.blueLight,
                          width: "max-content",
                        }}
                      >
                        <Zap size={12} style={{ color: B.blue }} />
                        <span
                          className="font-mono text-xs font-semibold"
                          style={{ color: B.blue }}
                        >
                          {item.ussdCode}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge active={item.isActive} />
                        <Toggle
                          checked={item.isActive}
                          onChange={(v) => toggleItem(item.id, v)}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/services/airtime-data/pins/${item.id}?type=${type}`}
                        className="inline-flex rounded-lg p-1.5 transition hover:bg-gray-200"
                        style={{ color: B.textFaint }}
                      >
                        <Edit2 size={13} />
                      </Link>
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
