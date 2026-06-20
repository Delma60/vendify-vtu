// vtu-web/components/admin/airtime-data/NetworkTypesTab.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Smartphone, Plus, Loader2, Search, Edit2 } from "lucide-react";
import { updateNetworkType } from "@/lib/db/helpers";
import { Toggle } from "@/components/ui/toggle";
import { NetworkTypeModal } from "@/components/admin/CreateNetworkTypeModal";
import { AirtimeTypeConfig } from "@/types";
import { B, NETWORK_FILTER_OPTIONS } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

export function NetworkTypesTab({
  initialItems = [],
}: {
  initialItems?: AirtimeTypeConfig[];
}) {
  const [items, setItems] = useState<AirtimeTypeConfig[]>(initialItems);
  const [networkFilter, setNetworkFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(initialItems.length === 0);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<AirtimeTypeConfig | null>(null);
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

  // The server already seeds `initialItems` for first paint — only fall
  // back to a client fetch if that seed came back empty.
  useEffect(() => {
    if (initialItems.length > 0) return;

    (async function () {
      try {
        const res = await fetch(`/api/v1/networks/types`);
        const { data } = await res.json();
        if (data) setItems(data);
      } catch (error) {
        showToast("Failed to fetch network types", "error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = items?.filter((i) => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  function toggleItem(id: string, val: boolean) {
    updateNetworkType(id, { isActive: val }).then(() => {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, isActive: val } : i)),
      );
      showToast(`Network type ${val ? "enabled" : "disabled"}.`);
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2
          size={24}
          className="animate-spin"
          style={{ color: B.orange }}
        />
        <span
          className="mt-2 text-sm font-medium"
          style={{ color: B.textMuted }}
        >
          Loading network types...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex flex-1 items-center gap-2 rounded-xl border px-3 py-2"
          style={{ borderColor: B.border, minWidth: 180 }}
        >
          <Search size={14} style={{ color: B.textFaint }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search network types…"
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
        <button
          onClick={() => {
            setShowModal(true);
            setEditItem(null);
          }}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
          style={{
            background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
          }}
        >
          <Plus size={14} />
          Add type
        </button>
      </div>

      {/* Table */}
      <Card>
        {filtered?.length === 0 ? (
          <EmptyState
            icon={Smartphone}
            title="No network types found"
            description="Try adjusting filters or add a new network type."
            // addLink="/admin/services/airtime-data/network-types/new"
            action={{
                label: "Add new network type",
                onClick: () => location.href ="/admin/services/airtime-data/network-types/new"
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                  {["Name", "Type", "Status", ""].map((h) => (
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
                    className="group hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 ">
                      <div
                        className="text-sm font-medium"
                        style={{ color: B.text }}
                      >
                        {item.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        {item.type}
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
                      <button
                        onClick={() => {
                          setShowModal(true);
                          setEditItem(item);
                        }}
                        className="inline-flex rounded-lg p-1.5 transition hover:bg-gray-200"
                        style={{ color: B.textFaint }}
                      >
                        <Edit2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && (
        <NetworkTypeModal
          item={editItem}
          onClose={() => setShowModal(false)}
          onSave={(data) => {
            if (editItem) {
              setItems((prev) =>
                prev.map((i) => (i.id === editItem.id ? { ...i, ...data } : i)),
              );
              showToast("Airtime type updated.");
            } else {
              setItems((prev) => [
                ...prev,
                { ...data, id: `at${Date.now()}` } as AirtimeTypeConfig,
              ]);
              showToast("Airtime type added.");
            }
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}