// vtu-web/components/admin/airtime-data/AirtimeDiscountsTab.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Percent, Edit2, Trash2, Loader2 } from "lucide-react";
import { AirtimeDiscount, deleteAirtimeDiscount } from "@/lib/db/helpers";
import { Toggle } from "@/components/ui/toggle";
import { B, NETWORK_FILTER_OPTIONS } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { fmt } from "@/lib/utils/price";
import { StatusBadge } from "@/components/ui/status-badge";

// NOTE: there's no confirmed `getAllAirtimeDiscounts()` server helper yet
// (only a single-record `getAirtimeDiscount(id)`), so this tab still fetches
// its list from `/api/internal/airtime-discounts` on mount. Once a list
// helper exists, fetch it in the server `page.tsx` and pass it down as
// `initialItems`, the same way NetworksTab/NetworkTypesTab/DataPlansTab do.
export function AirtimeDiscountsTab() {
  const [items, setItems] = useState<AirtimeDiscount[]>([]);
  const [networkFilter, setNetworkFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);

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

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/internal/airtime-discounts");
        const { data } = await res.json();
        setItems(data);
      } catch {
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const filtered = items?.filter((i) =>
    networkFilter === "all" ? true : i.network_id === networkFilter,
  );

  function toggleItem(id: string, val: boolean) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isActive: val } : i)),
    );
    showToast(`Discount ${val ? "enabled" : "disabled"}.`);
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this discount?")) return;
    await deleteAirtimeDiscount(id).then(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
      showToast("Discount deleted.", "warn");
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center align-center">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
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
          href="/admin/services/airtime-data/discounts/new"
          className="ml-auto flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
          style={{
            background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
          }}
        >
          <Plus size={14} />
          Add discount
        </Link>
      </div>

      <Card className="overflow-hidden">
        {filtered?.length === 0 ? (
          <EmptyState
            icon={Percent}
            title="No discounts configured"
            action={{
              label: "Add new",
              onClick() {
                location.href = "/admin/services/airtime-data/discounts/new";
              },
            }}
            // addLink="/admin/services/airtime-data/discounts/new"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px]">
              <thead>
                <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                  {["Details", "Min|Max", "Status", ""].map((h) => (
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
                {filtered?.map((item) => (
                  <tr
                    key={item.id}
                    className="group transition-colors hover:bg-gray-50"
                  >
                    <td
                      className="px-4 py-3 text-sm font-bold"
                      style={{ color: B.text }}
                    >
                      {item.network?.name} | {item.type}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-700">
                      {fmt(item.minAmountKobo)} | {fmt(item.maxAmountKobo)}
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <Link
                          href={`/admin/services/airtime-data/discounts/${item.id}`}
                          className="rounded-lg p-1.5 transition hover:bg-gray-200"
                          style={{ color: B.textFaint }}
                        >
                          <Edit2 size={13} />
                        </Link>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="rounded-lg p-1.5 transition hover:bg-red-50"
                          style={{ color: B.red }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
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
