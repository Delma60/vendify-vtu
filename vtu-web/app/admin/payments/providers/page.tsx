"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface PaymentProvider {
  id: string;
  name: string;
  isActive: boolean;
  publicKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  feePercentage?: number;
  feeCap?: number;
}

export default function AdminPaymentProvidersPage() {
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create Modal State
  const [showModal, setShowModal] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/internal/payment-providers");
      const json = await res.json();
      if (json.success) {
        setProviders(json.data);
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError("Failed to fetch providers");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    id: string,
    field: keyof PaymentProvider,
    value: any,
  ) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  };

  // --- CREATE ---
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/payment-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newId, name: newName, isActive: false }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error);
      } else {
        setShowModal(false);
        setNewId("");
        setNewName("");
        fetchProviders(); // Refresh list
      }
    } catch (err) {
      setError("Network error while creating provider.");
    } finally {
      setIsCreating(false);
    }
  };

  // --- UPDATE ---
  const handleSave = async (provider: PaymentProvider) => {
    setSavingId(provider.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/internal/payment-providers/${provider.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isActive: provider.isActive,
            publicKey: provider.publicKey,
            secretKey: provider.secretKey,
            webhookSecret: provider.webhookSecret,
            feePercentage: Number(provider.feePercentage) || 0,
            feeCap: Number(provider.feeCap) || 0,
          }),
        },
      );

      const json = await res.json();
      if (!json.success) setError(json.error);
      else alert(`${provider.name} updated successfully!`);
    } catch (err) {
      setError("A network error occurred while saving.");
    } finally {
      setSavingId(null);
    }
  };

  // --- DELETE ---
  const handleDelete = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${name}? This action cannot be fully undone.`,
      )
    )
      return;

    setError(null);
    try {
      const res = await fetch(`/api/internal/payment-providers/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!json.success) setError(json.error);
      else setProviders((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError("A network error occurred while deleting.");
    }
  };

  if (loading)
    return (
      <div className="p-8 text-gray-500">Loading payment providers...</div>
    );

  return (
    <div className="max-w-5xl p-6 mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Gateways</h1>
          <p className="text-sm text-gray-500">
            Manage active payment processors and their API credentials.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>Add Gateway</Button>
      </div>

      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-100 rounded-md">
          {error}
        </div>
      )}

      {/* CREATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">
              Initialize Payment Gateway
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium">
                  Gateway ID (lowercase, no spaces)
                </label>
                <input
                  required
                  type="text"
                  pattern="[a-z0-9_-]+"
                  className="w-full px-3 py-2 border rounded-md"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  placeholder="e.g., flutterwave, paystack"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">
                  Display Name
                </label>
                <input
                  required
                  type="text"
                  className="w-full px-3 py-2 border rounded-md"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Flutterwave"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Creating..." : "Create Gateway"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GATEWAY LIST */}
      <div className="space-y-6">
        {providers.length === 0 ? (
          <p className="text-gray-500">No payment providers configured yet.</p>
        ) : (
          providers.map((provider) => (
            <div
              key={provider.id}
              className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {provider.name}{" "}
                  <span className="text-xs font-normal text-gray-400">
                    ({provider.id})
                  </span>
                </h2>
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-600">
                    Active
                  </span>
                  <input
                    type="checkbox"
                    checked={provider.isActive}
                    onChange={(e) =>
                      handleInputChange(
                        provider.id,
                        "isActive",
                        e.target.checked,
                      )
                    }
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Public Key
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md"
                    value={provider.publicKey || ""}
                    onChange={(e) =>
                      handleInputChange(
                        provider.id,
                        "publicKey",
                        e.target.value,
                      )
                    }
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Secret Key
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border rounded-md"
                    value={provider.secretKey || ""}
                    onChange={(e) =>
                      handleInputChange(
                        provider.id,
                        "secretKey",
                        e.target.value,
                      )
                    }
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Webhook Secret
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border rounded-md"
                    value={provider.webhookSecret || ""}
                    onChange={(e) =>
                      handleInputChange(
                        provider.id,
                        "webhookSecret",
                        e.target.value,
                      )
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      Fee (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full px-3 py-2 border rounded-md"
                      value={provider.feePercentage || ""}
                      onChange={(e) =>
                        handleInputChange(
                          provider.id,
                          "feePercentage",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      Fee Cap (Kobo)
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border rounded-md"
                      value={provider.feeCap || ""}
                      onChange={(e) =>
                        handleInputChange(provider.id, "feeCap", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(provider.id, provider.name)}
                >
                  Delete Gateway
                </Button>
                <Button
                  onClick={() => handleSave(provider)}
                  disabled={savingId === provider.id}
                >
                  {savingId === provider.id
                    ? "Saving..."
                    : "Save Configuration"}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
