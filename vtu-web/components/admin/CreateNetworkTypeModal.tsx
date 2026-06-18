import { AirtimeTypeConfig, Network } from "@/types";
import { useState } from "react";
import { Toggle } from "../ui/toggle";
import { B } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function NetworkTypeModal({
  item,
  onClose,
  onSave,
}: {
  item: AirtimeTypeConfig | null;
  onClose: () => void;
  onSave: (data: Partial<AirtimeTypeConfig>) => void;
}) {
  const [form, setForm] = useState<Partial<AirtimeTypeConfig>>(
    item ?? {
      type: "airtime",
      name: "",
      isActive: true,
    },
  );
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await fetch("/api/v1/networks/types", {
      method: item ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    onSave(form);
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
        style={{ border: `1px solid ${B.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-bold" style={{ color: B.text }}>
          {item ? "Edit airtime type" : "Add airtime type"}
        </h2>

        <div className="space-y-3">
          <div>
            <label
              className="mb-1 block text-xs font-semibold"
              style={{ color: B.textMuted }}
            >
              Name
            </label>
            <input
              value={form.name ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. MTN VTU Standard"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: B.border, color: B.text }}
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label
                className="mb-1 block text-xs font-semibold"
                style={{ color: B.textMuted }}
              >
                For Service
              </label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    type: e.target.value as any,
                  }))
                }
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: B.border, color: B.text }}
              >
                {[{ name: "airtime" }, { name: "data" }].map((n) => (
                  <option key={n.name} value={n.name}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            className="flex items-center justify-between rounded-xl p-3"
            style={{ background: B.surface }}
          >
            <span className="text-sm font-medium" style={{ color: B.text }}>
              Active
            </span>
            <Toggle
              checked={form.isActive ?? true}
              onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
            />
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold"
            style={{ border: `1.5px solid ${B.border}`, color: B.text }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !form.name}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
            }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Saving…" : item ? "Save changes" : "Add type"}
          </button>
        </div>
      </div>
    </div>
  );
}
