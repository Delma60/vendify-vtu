import { useState } from "react";
import { Loader2, X, CheckCircle2 } from "lucide-react";

interface CreateNetworkModalProps {
  isOpen: boolean;
  id: string;
  onClose: () => void;
  onSuccess: (newNetwork: any) => void;
}

export function CreateNetworkModal({
  id = "1",
  isOpen,
  onClose,
  onSuccess,
}: CreateNetworkModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    id,
    name: "",
    code: "",
    type: "telecom",
    shortcode: "",
    color: "#000000",
    logoLetter: "",
    isActive: true,
  });

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/networks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // Set default UI toggles for new networks
          id,
          airtimeEnabled: true,
          dataEnabled: true,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || "Failed to create network");
      }

      // Pass the newly created network back to the parent to update the UI instantly
      onSuccess(json.data?.network || json.network);

      // Reset form
      setForm({
        id: '',
        name: "",
        code: "",
        type: "telecom",
        shortcode: "",
        color: "#000000",
        logoLetter: "",
        isActive: true,
      });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        // If you click inside the modal, don't close it
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-5 py-4">
          <h2 className="text-lg font-bold text-gray-900">Add New Network</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-600">
                Network Name
              </label>
              <input
                required
                placeholder="e.g. MTN Nigeria"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-600">
                Code (Unique ID)
              </label>
              <input
                required
                placeholder="e.g. mtn"
                value={form.code}
                onChange={(e) =>
                  setForm({
                    ...form,
                    code: e.target.value.toLowerCase().replace(/\s+/g, ""),
                  })
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-600">
                Service Type
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="telecom">Telecom (Airtime/Data)</option>
                <option value="cable">Cable TV</option>
                <option value="electricity">Electricity</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-600">
                USSD / Shortcode
              </label>
              <input
                placeholder="e.g. *312#"
                value={form.shortcode}
                onChange={(e) =>
                  setForm({ ...form, shortcode: e.target.value })
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Visual Settings */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
              Visuals
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600">
                  Brand Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) =>
                      setForm({ ...form, color: e.target.value })
                    }
                    className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <span className="text-xs text-gray-500 uppercase">
                    {form.color}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600">
                  Logo Letter
                </label>
                <input
                  required
                  maxLength={2}
                  placeholder="e.g. M"
                  value={form.logoLetter}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      logoLetter: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm uppercase focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Create Network
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
