// vtu-web/components/admin/airtime-data/NetworksTab.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  Smartphone,
  Wifi,
  Plus,
  Loader2,
  Edit2,
  Save,
  Network as NetworkIcon,
} from "lucide-react";
import { CreateNetworkModal } from "@/components/admin/CreateNetworkModal";
import { updateNetwork } from "@/lib/db/helpers";
import { Toggle } from "@/components/ui/toggle";
import { Network } from "@/types";
import { B } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
// import { B } from "./constants";
// import { Card, StatusBadge, EmptyState, Toast } from "./ui";
// import type { Network } from "./types";

export function NetworksTab({
  initialNetworks = [],
}: {
  initialNetworks?: Network[];
}) {
  const [networks, setNetworks] = useState<Network[]>(initialNetworks);
  const [loading, setLoading] = useState(initialNetworks.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Network>>({});
  const [saving, setSaving] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  // The server already seeds `initialNetworks` for first paint — only fall
  // back to a client fetch if that seed came back empty.
  useEffect(() => {
    if (initialNetworks.length > 0) return;

    async function fetchNetworks() {
      try {
        const response = await fetch("/api/v1/networks");
        const json = await response.json();

        if (response.ok) {
          setNetworks(json.data?.networks || json.networks || []);
        } else {
          //   showToast(json.message || "Failed to load networks", "error");
          toast.error(json.message || "Failed to load networks");
        }
      } catch (error) {
        // showToast("Network error. Could not connect to API.", "error");
        toast.error("Network error. Could not connect to API.");
      } finally {
        setLoading(false);
      }
    }
    fetchNetworks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(net: Network) {
    setEditingId(net.id);
    setEditForm({ ...net });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
  }

  async function saveEdit() {
    if (!editingId) return;

    setSaving(true);
    await updateNetwork(editForm?.code || "", editForm)
      .then(() => {
        setNetworks((prev) =>
          prev.map((n) => (n.id === editingId ? { ...n, ...editForm } : n)),
        );

        // showToast("Network updated.");
        toast.success("Network updated.");
        setEditingId(null);
        setEditForm({});
      })
      .catch(() => toast.error("Failed to save changes. Try again."))
      .finally(() => setSaving(false));
  }

  async function toggleNetwork(
    id: string,
    field: "isActive" | "airtimeEnabled" | "dataEnabled",
    val: boolean,
  ) {
    setNetworks((prev) =>
      prev.map((n) => (n.code === id ? { ...n, [field]: val } : n)),
    );

    updateNetwork(id, { [field]: val })
      .then(() => {
        toast.success(
          `${field === "isActive" ? "Network" : field === "airtimeEnabled" ? "Airtime" : "Data"} ${val ? "enabled" : "disabled"}.`,
        );
      })
      .catch(() => {
        setNetworks((prev) =>
          prev.map((n) => (n.code === id ? { ...n, [field]: !val } : n)),
        );
        toast.success("Failed to update setting.");
      });
  }

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: B.text }}>
            Active Networks
          </h2>
          <p className="text-sm" style={{ color: B.textMuted }}>
            Manage your supported telecom, cable, and electricity providers.
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
          style={{
            background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
          }}
        >
          <Plus size={16} />
          Add Network
        </button>
      </div>
      {networks.length === 0 && (
        <div className="">
          <EmptyState title="No networks found" icon={NetworkIcon} />
        </div>
      )}
      {networks.map((net) => (
        <Card key={net.id} className="overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-black text-white shadow-md"
                style={{ background: net.color }}
              >
                {net.logoLetter}
              </div>

              {editingId === net.id ? (
                /* Edit mode */
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  <input
                    value={editForm.name ?? ""}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="rounded-xl border px-3 py-1.5 text-sm font-semibold"
                    style={{ borderColor: B.border, color: B.text, width: 120 }}
                  />
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={cancelEdit}
                      className="rounded-xl border px-3 py-1.5 text-sm font-semibold"
                      style={{ borderColor: B.border, color: B.textMuted }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold text-white"
                      style={{
                        background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
                      }}
                    >
                      {saving ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Save size={13} />
                      )}
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  <div>
                    <p className="text-sm font-bold" style={{ color: B.text }}>
                      {net.name}
                    </p>
                    <p className="text-xs" style={{ color: B.textFaint }}>
                      {net.shortcode}
                    </p>
                  </div>

                  <div className="ml-4 flex flex-wrap items-center gap-4">
                    {/* Airtime toggle */}
                    <div className="flex items-center gap-1.5">
                      <Smartphone size={13} style={{ color: B.textFaint }} />
                      <span
                        className="text-xs font-medium"
                        style={{ color: B.textMuted }}
                      >
                        Airtime
                      </span>
                      <Toggle
                        checked={net.airtimeEnabled}
                        onChange={(v) =>
                          toggleNetwork(net.code, "airtimeEnabled", v)
                        }
                      />
                    </div>

                    {/* Data toggle */}
                    <div className="flex items-center gap-1.5">
                      <Wifi size={13} style={{ color: B.textFaint }} />
                      <span
                        className="text-xs font-medium"
                        style={{ color: B.textMuted }}
                      >
                        Data
                      </span>
                      <Toggle
                        checked={net.dataEnabled}
                        onChange={(v) =>
                          toggleNetwork(net.code, "dataEnabled", v)
                        }
                      />
                    </div>
                  </div>

                  <div className="ml-auto flex items-center gap-3">
                    <StatusBadge active={net.isActive} />
                    <Toggle
                      checked={net.isActive}
                      onChange={(v) => toggleNetwork(net.code, "isActive", v)}
                    />
                    <button
                      onClick={() => startEdit(net)}
                      className="rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition hover:bg-gray-50"
                      style={{ borderColor: B.border, color: B.textMuted }}
                    >
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
      <CreateNetworkModal
        isOpen={isCreateModalOpen}
        id={networks?.length.toString()}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(newNetwork) => {
          setNetworks((prev) =>
            [...prev, newNetwork].sort((a, b) => a.name.localeCompare(b.name)),
          );
          toast.success(`Successfully added ${newNetwork.name}!`);
        }}
      />
    </div>
  );
}
