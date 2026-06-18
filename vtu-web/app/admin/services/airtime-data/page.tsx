// // vtu-web/app/admin/services/airtime-data/page.tsx
// "use client";

// import React, { useCallback, useEffect, useState } from "react";
// import {
//   Smartphone,
//   Wifi,
//   Plus,
//   RefreshCw,
//   Loader2,
//   Search,
//   ToggleLeft,
//   ToggleRight,
//   Edit2,
//   Trash2,
//   X,
//   Check,
//   AlertTriangle,
//   ChevronDown,
//   ChevronUp,
//   Tag,
//   Percent,
//   Database,
//   Key,
//   Network,
//   Settings,
//   Save,
//   Copy,
//   Eye,
//   EyeOff,
//   TrendingUp,
//   Package,
//   Shield,
//   Zap,
// } from "lucide-react";
// import { CreateNetworkModal } from "@/components/admin/CreateNetworkModal";
// import { baseUrl, updateNetwork, updateNetworkType } from "@/lib/db/helpers";

// // ─── Brand tokens (matching admin layout) ─────────────────────────────────────

// const B = {
//   orange: "#F97316",
//   orangeDark: "#EA580C",
//   orangeLight: "rgba(249,115,22,0.10)",
//   green: "#22C55E",
//   greenLight: "rgba(34,197,94,0.10)",
//   red: "#EF4444",
//   redLight: "rgba(239,68,68,0.10)",
//   amber: "#F59E0B",
//   amberLight: "rgba(245,158,11,0.10)",
//   blue: "#3B82F6",
//   blueLight: "rgba(59,130,246,0.10)",
//   purple: "#8B5CF6",
//   purpleLight: "rgba(139,92,246,0.10)",
//   text: "#111827",
//   textMuted: "#6B7280",
//   textFaint: "#9CA3AF",
//   border: "#E5E7EB",
//   surface: "#F9FAFB",
// };

// // ─── Types ────────────────────────────────────────────────────────────────────

// type NetworkId = "mtn" | "airtel" | "glo" | "9mobile";
// type AirtimeType = "airtime" | "data" | "cable";
// type DataCategory = "SME" | "Gifting" | "Corporate" | "Direct";
// type TabId =
//   | "networks"
//   | "airtime-types"
//   | "airtime-discounts"
//   | "data-types"
//   | "data-plans"
//   | "airtime-pin"
//   | "data-pin";

// interface Network {
//   id: string;
//   code: NetworkId;
//   name: string;
//   color: string;
//   logoLetter: string;
//   isActive: boolean;
//   airtimeEnabled: boolean;
//   dataEnabled: boolean;
//   shortcode: string;
// }

// interface AirtimeTypeConfig {
//   id: string;
//   type: AirtimeType;
//   name: string;
//   isActive: boolean;
// }

// interface AirtimeDiscount {
//   id: string;
//   network: NetworkId;
//   type: AirtimeType;
//   label: string;
//   discountPercent: number;
//   minAmountKobo: number;
//   isActive: boolean;
//   validFrom: string;
//   validTo: string | null;
// }

// interface DataType {
//   id: string;
//   network: NetworkId;
//   category: DataCategory;
//   label: string;
//   isActive: boolean;
//   description: string;
// }

// interface DataPlan {
//   id: string;
//   network: NetworkId;
//   category: DataCategory;
//   name: string;
//   size: string;
//   validity: string;
//   costPriceKobo: number;
//   sellPriceKobo: number;
//   providerPlanId: string;
//   isActive: boolean;
// }

// interface PinConfig {
//   id: string;
//   network: NetworkId;
//   type: "airtime" | "data";
//   label: string;
//   pin: string;
//   ussdCode: string;
//   isActive: boolean;
//   notes: string;
// }

// // ─── Mock data ────────────────────────────────────────────────────────────────

// const NETWORKS: Network[] = [
//   {
//     id: "mtn",
//     code: "mtn",
//     name: "MTN",
//     color: "#FFCC00",
//     logoLetter: "M",
//     isActive: true,
//     airtimeEnabled: true,
//     dataEnabled: true,
//     shortcode: "*556#",
//   },
//   {
//     id: "airtel",
//     code: "airtel",
//     name: "Airtel",
//     color: "#E0001A",
//     logoLetter: "A",
//     isActive: true,
//     airtimeEnabled: true,
//     dataEnabled: true,
//     shortcode: "*140#",
//   },
//   {
//     id: "glo",
//     code: "glo",
//     name: "Glo",
//     color: "#60B527",
//     logoLetter: "G",
//     isActive: true,
//     airtimeEnabled: true,
//     dataEnabled: true,
//     shortcode: "*127*0#",
//   },
//   {
//     id: "9mobile",
//     code: "9mobile",
//     name: "9mobile",
//     color: "#008751",
//     logoLetter: "9",
//     isActive: false,
//     airtimeEnabled: true,
//     dataEnabled: false,
//     shortcode: "*228#",
//   },
// ];

// const AIRTIME_DISCOUNTS: AirtimeDiscount[] = [
//   {
//     id: "ad1",
//     network: "mtn",
//     type: "VTU",
//     label: "MTN VTU Standard",
//     discountPercent: 3,
//     minAmountKobo: 5000,
//     isActive: true,
//     validFrom: "2024-01-01",
//     validTo: null,
//   },
//   {
//     id: "ad2",
//     network: "mtn",
//     type: "SNS",
//     label: "MTN SNS Reseller",
//     discountPercent: 2,
//     minAmountKobo: 10000,
//     isActive: true,
//     validFrom: "2024-01-01",
//     validTo: "2024-12-31",
//   },
//   {
//     id: "ad3",
//     network: "airtel",
//     type: "VTU",
//     label: "Airtel VTU Standard",
//     discountPercent: 3,
//     minAmountKobo: 5000,
//     isActive: true,
//     validFrom: "2024-01-01",
//     validTo: null,
//   },
//   {
//     id: "ad4",
//     network: "glo",
//     type: "VTU",
//     label: "Glo VTU Premium",
//     discountPercent: 4,
//     minAmountKobo: 5000,
//     isActive: false,
//     validFrom: "2024-06-01",
//     validTo: "2024-09-30",
//   },
// ];

// const DATA_TYPES: DataType[] = [
//   {
//     id: "dt1",
//     network: "mtn",
//     category: "SME",
//     label: "MTN SME Data",
//     isActive: true,
//     description: "Affordable data for small businesses and personal use",
//   },
//   {
//     id: "dt2",
//     network: "mtn",
//     category: "Gifting",
//     label: "MTN Gifting Data",
//     isActive: true,
//     description: "Data bundles that can be gifted to other MTN subscribers",
//   },
//   {
//     id: "dt3",
//     network: "mtn",
//     category: "Corporate",
//     label: "MTN Corporate Data",
//     isActive: false,
//     description: "Enterprise-level data plans for businesses",
//   },
//   {
//     id: "dt4",
//     network: "airtel",
//     category: "SME",
//     label: "Airtel SME Data",
//     isActive: true,
//     description: "SME data plans on Airtel network",
//   },
//   {
//     id: "dt5",
//     network: "airtel",
//     category: "Corporate",
//     label: "Airtel Corporate",
//     isActive: true,
//     description: "Corporate data for Airtel businesses",
//   },
//   {
//     id: "dt6",
//     network: "glo",
//     category: "Direct",
//     label: "Glo Direct Data",
//     isActive: true,
//     description: "Direct Glo network data plans",
//   },
// ];

// const DATA_PLANS: DataPlan[] = [
//   {
//     id: "dp1",
//     network: "mtn",
//     category: "SME",
//     name: "500MB",
//     size: "500MB",
//     validity: "30 Days",
//     costPriceKobo: 13000,
//     sellPriceKobo: 15000,
//     providerPlanId: "mtn-sme-500mb",
//     isActive: true,
//   },
//   {
//     id: "dp2",
//     network: "mtn",
//     category: "SME",
//     name: "1GB",
//     size: "1GB",
//     validity: "30 Days",
//     costPriceKobo: 24000,
//     sellPriceKobo: 28000,
//     providerPlanId: "mtn-sme-1gb",
//     isActive: true,
//   },
//   {
//     id: "dp3",
//     network: "mtn",
//     category: "SME",
//     name: "2GB",
//     size: "2GB",
//     validity: "30 Days",
//     costPriceKobo: 47000,
//     sellPriceKobo: 55000,
//     providerPlanId: "mtn-sme-2gb",
//     isActive: true,
//   },
//   {
//     id: "dp4",
//     network: "mtn",
//     category: "Gifting",
//     name: "1GB Gifting",
//     size: "1GB",
//     validity: "30 Days",
//     costPriceKobo: 28000,
//     sellPriceKobo: 32000,
//     providerPlanId: "mtn-gift-1gb",
//     isActive: true,
//   },
//   {
//     id: "dp5",
//     network: "airtel",
//     category: "SME",
//     name: "1GB",
//     size: "1GB",
//     validity: "30 Days",
//     costPriceKobo: 24000,
//     sellPriceKobo: 28000,
//     providerPlanId: "airtel-sme-1gb",
//     isActive: true,
//   },
//   {
//     id: "dp6",
//     network: "airtel",
//     category: "Corporate",
//     name: "5GB Corporate",
//     size: "5GB",
//     validity: "30 Days",
//     costPriceKobo: 115000,
//     sellPriceKobo: 130000,
//     providerPlanId: "airtel-corp-5gb",
//     isActive: false,
//   },
//   {
//     id: "dp7",
//     network: "glo",
//     category: "Direct",
//     name: "2.9GB",
//     size: "2.9GB",
//     validity: "30 Days",
//     costPriceKobo: 77000,
//     sellPriceKobo: 90000,
//     providerPlanId: "glo-direct-2.9gb",
//     isActive: true,
//   },
// ];

// const PIN_CONFIGS: PinConfig[] = [
//   {
//     id: "pc1",
//     network: "mtn",
//     type: "airtime",
//     label: "MTN Airtime Balance",
//     pin: "*556#",
//     ussdCode: "*556#",
//     isActive: true,
//     notes: "Check airtime balance on MTN",
//   },
//   {
//     id: "pc2",
//     network: "mtn",
//     type: "data",
//     label: "MTN Data Balance",
//     pin: "*461*4#",
//     ussdCode: "*461*4#",
//     isActive: true,
//     notes: "Check data balance on MTN",
//   },
//   {
//     id: "pc3",
//     network: "airtel",
//     type: "airtime",
//     label: "Airtel Airtime Balance",
//     pin: "*140#",
//     ussdCode: "*140#",
//     isActive: true,
//     notes: "Check airtime balance on Airtel",
//   },
//   {
//     id: "pc4",
//     network: "airtel",
//     type: "data",
//     label: "Airtel Data Balance",
//     pin: "*140#",
//     ussdCode: "*140*1#",
//     isActive: true,
//     notes: "Check data balance on Airtel",
//   },
//   {
//     id: "pc5",
//     network: "glo",
//     type: "airtime",
//     label: "Glo Airtime Balance",
//     pin: "*124*1#",
//     ussdCode: "*124*1#",
//     isActive: true,
//     notes: "Check airtime balance on Glo",
//   },
//   {
//     id: "pc6",
//     network: "glo",
//     type: "data",
//     label: "Glo Data Balance",
//     pin: "*127*0#",
//     ussdCode: "*127*0#",
//     isActive: false,
//     notes: "Check data balance on Glo",
//   },
// ];

// // ─── Helpers ──────────────────────────────────────────────────────────────────

// function fmt(kobo: number) {
//   return `₦${(kobo / 100).toLocaleString("en-NG", {
//     minimumFractionDigits: 0,
//     maximumFractionDigits: 0,
//   })}`;
// }

// function marginPct(cost: number, sell: number) {
//   if (!sell || !cost) return null;
//   return (((sell - cost) / sell) * 100).toFixed(1);
// }

// function networkColor(code: NetworkId) {
//   return NETWORKS.find((n) => n.code === code)?.color ?? B.textFaint;
// }

// function networkName(code: NetworkId) {
//   return NETWORKS.find((n) => n.code === code)?.name ?? code;
// }

// const NETWORK_FILTER_OPTIONS: { value: string; label: string }[] = [
//   { value: "all", label: "All networks" },
//   { value: "mtn", label: "MTN" },
//   { value: "airtel", label: "Airtel" },
//   { value: "glo", label: "Glo" },
//   { value: "9mobile", label: "9mobile" },
// ];

// // ─── Shared UI primitives ─────────────────────────────────────────────────────

// function Card({
//   children,
//   className = "",
// }: {
//   children: React.ReactNode;
//   className?: string;
// }) {
//   return (
//     <div
//       className={`rounded-2xl bg-white ${className}`}
//       style={{ border: `1px solid ${B.border}` }}
//     >
//       {children}
//     </div>
//   );
// }

// function Toggle({
//   checked,
//   onChange,
//   disabled,
// }: {
//   checked: boolean;
//   onChange: (v: boolean) => void;
//   disabled?: boolean;
// }) {
//   return (
//     <button
//       onClick={() => !disabled && onChange(!checked)}
//       disabled={disabled}
//       className="flex items-center transition-all active:scale-95 disabled:opacity-40"
//     >
//       {checked ? (
//         <ToggleRight size={26} style={{ color: B.green }} strokeWidth={2} />
//       ) : (
//         <ToggleLeft size={26} style={{ color: B.textFaint }} strokeWidth={2} />
//       )}
//     </button>
//   );
// }

// function StatusBadge({ active }: { active: boolean }) {
//   return (
//     <span
//       className="rounded-full px-2 py-0.5 text-[11px] font-bold"
//       style={{
//         background: active ? B.greenLight : B.redLight,
//         color: active ? B.green : B.red,
//       }}
//     >
//       {active ? "Active" : "Inactive"}
//     </span>
//   );
// }

// function NetworkBadge({ code }: { code: NetworkId }) {
//   const net = NETWORKS.find((n) => n.code === code);
//   return (
//     <span
//       className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold"
//       style={{
//         background: `${net?.color ?? "#ccc"}18`,
//         color: net?.color ?? B.textFaint,
//       }}
//     >
//       <span
//         className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white"
//         style={{ background: net?.color ?? "#ccc" }}
//       >
//         {net?.logoLetter}
//       </span>
//       {net?.name ?? code}
//     </span>
//   );
// }

// function Toast({
//   msg,
//   type = "success",
// }: {
//   msg: string;
//   type?: "success" | "error" | "warn";
// }) {
//   const colors = {
//     success: B.green,
//     error: B.red,
//     warn: B.amber,
//   };
//   return (
//     <div
//       className="fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-2xl"
//       style={{ background: colors[type] }}
//     >
//       {type === "success" ? (
//         <Check size={14} />
//       ) : type === "warn" ? (
//         <AlertTriangle size={14} />
//       ) : (
//         <X size={14} />
//       )}
//       {msg}
//     </div>
//   );
// }

// function EmptyState({
//   icon: Icon,
//   title,
//   subtitle,
//   onAdd,
// }: {
//   icon: React.ElementType;
//   title: string;
//   subtitle?: string;
//   onAdd?: () => void;
// }) {
//   return (
//     <div className="flex flex-col items-center justify-center py-16 text-center">
//       <div
//         className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
//         style={{ background: B.orangeLight }}
//       >
//         <Icon size={26} style={{ color: B.orange }} />
//       </div>
//       <p className="text-sm font-semibold" style={{ color: B.text }}>
//         {title}
//       </p>
//       {subtitle && (
//         <p className="mt-1 text-xs" style={{ color: B.textFaint }}>
//           {subtitle}
//         </p>
//       )}
//       {onAdd && (
//         <button
//           onClick={onAdd}
//           className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white"
//           style={{
//             background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
//           }}
//         >
//           <Plus size={14} />
//           Add first entry
//         </button>
//       )}
//     </div>
//   );
// }

// // ─── Tab: Networks ────────────────────────────────────────────────────────────

// function NetworksTab() {
//   const [networks, setNetworks] = useState<Network[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [editingId, setEditingId] = useState<string | null>(null);
//   const [editForm, setEditForm] = useState<Partial<Network>>({});
//   const [saving, setSaving] = useState(false);
//   const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
//   const [toast, setToast] = useState<{
//     msg: string;
//     type: "success" | "error";
//   } | null>(null);

//   // 1. READ: Fetch all networks on mount
//   useEffect(() => {
//     async function fetchNetworks() {
//       try {
//         const response = await fetch("/api/v1/networks");
//         const json = await response.json();

//         if (response.ok) {
//           // Based on your ok() response wrapper shape
//           setNetworks(json.data?.networks || json.networks || []);
//         } else {
//           showToast(json.message || "Failed to load networks", "error");
//         }
//       } catch (error) {
//         showToast("Network error. Could not connect to API.", "error");
//       } finally {
//         setLoading(false);
//       }
//     }
//     fetchNetworks();
//   }, []);

//   function showToast(msg: string, type: "success" | "error" = "success") {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3000);
//   }

//   function startEdit(net: Network) {
//     setEditingId(net.id);
//     setEditForm({ ...net });
//   }

//   function cancelEdit() {
//     setEditingId(null);
//     setEditForm({});
//   }

//   // 2. UPDATE: Save edited fields (Name, Shortcode)
//   async function saveEdit() {
//     if (!editingId) return;

//     setSaving(true);
//     await updateNetwork(editForm?.code || "", editForm)
//       .then(() => {
//         setNetworks((prev) =>
//           prev.map((n) => (n.id === editingId ? { ...n, ...editForm } : n)),
//         );

//         showToast("Network updated.");
//         setEditingId(null);
//         setEditForm({});
//       })
//       .catch(() => showToast("Failed to save changes. Try again.", "error"))
//       .finally(() => setSaving(false));
//   }

//   // 3. UPDATE: Toggle specific booleans instantly
//   async function toggleNetwork(
//     id: string,
//     field: "isActive" | "airtimeEnabled" | "dataEnabled",
//     val: boolean,
//   ) {
//     // Optimistic UI Update: Change it immediately so it feels snappy
//     setNetworks((prev) =>
//       prev.map((n) => (n.code === id ? { ...n, [field]: val } : n)),
//     );

//     updateNetwork(id, { [field]: val })
//       .then(() => {
//         showToast(
//           `${field === "isActive" ? "Network" : field === "airtimeEnabled" ? "Airtime" : "Data"} ${val ? "enabled" : "disabled"}.`,
//         );
//       })
//       .catch(() => {
//         setNetworks((prev) =>
//           prev.map((n) => (n.code === id ? { ...n, [field]: !val } : n)),
//         );
//         showToast("Failed to update setting.", "error");
//       });
//   }

//   // Optional: Return a simple loader while fetching initial data so it doesn't look broken
//   if (loading) {
//     return (
//       <div className="p-4 text-center text-sm text-gray-500 animate-pulse">
//         Loading networks...
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-3">
//       <div className="flex items-center justify-between">
//         <div>
//           <h2 className="text-lg font-bold" style={{ color: B.text }}>
//             Active Networks
//           </h2>
//           <p className="text-sm" style={{ color: B.textMuted }}>
//             Manage your supported telecom, cable, and electricity providers.
//           </p>
//         </div>
//         <button
//           onClick={() => setIsCreateModalOpen(true)}
//           className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
//           style={{
//             background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
//           }}
//         >
//           <Plus size={16} />
//           Add Network
//         </button>
//       </div>
//       {networks.length === 0 && (
//         <div className="">
//           <EmptyState title="No networks found" icon={Network} />
//         </div>
//       )}
//       {networks.map((net) => (
//         <Card key={net.id} className="overflow-hidden">
//           <div className="p-5">
//             <div className="flex items-center gap-4">
//               {/* Logo */}
//               <div
//                 className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-black text-white shadow-md"
//                 style={{ background: net.color }}
//               >
//                 {net.logoLetter}
//               </div>

//               {editingId === net.id ? (
//                 /* Edit mode */
//                 <div className="flex flex-1 flex-wrap items-center gap-3">
//                   <input
//                     value={editForm.name ?? ""}
//                     onChange={(e) =>
//                       setEditForm((f) => ({ ...f, name: e.target.value }))
//                     }
//                     className="rounded-xl border px-3 py-1.5 text-sm font-semibold"
//                     style={{ borderColor: B.border, color: B.text, width: 120 }}
//                   />
//                   {/* <input
//                     value={editForm.shortcode ?? ""}
//                     onChange={(e) =>
//                       setEditForm((f) => ({ ...f, shortcode: e.target.value }))
//                     }
//                     placeholder="USSD code"
//                     className="rounded-xl border px-3 py-1.5 text-sm"
//                     style={{ borderColor: B.border, color: B.text, width: 100 }}
//                   /> */}
//                   <div className="ml-auto flex items-center gap-2">
//                     <button
//                       onClick={cancelEdit}
//                       className="rounded-xl border px-3 py-1.5 text-sm font-semibold"
//                       style={{ borderColor: B.border, color: B.textMuted }}
//                     >
//                       Cancel
//                     </button>
//                     <button
//                       onClick={saveEdit}
//                       disabled={saving}
//                       className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold text-white"
//                       style={{
//                         background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
//                       }}
//                     >
//                       {saving ? (
//                         <Loader2 size={13} className="animate-spin" />
//                       ) : (
//                         <Save size={13} />
//                       )}
//                       Save
//                     </button>
//                   </div>
//                 </div>
//               ) : (
//                 /* View mode */
//                 <div className="flex flex-1 flex-wrap items-center gap-3">
//                   <div>
//                     <p className="text-sm font-bold" style={{ color: B.text }}>
//                       {net.name}
//                     </p>
//                     <p className="text-xs" style={{ color: B.textFaint }}>
//                       {net.shortcode}
//                     </p>
//                   </div>

//                   <div className="ml-4 flex flex-wrap items-center gap-4">
//                     {/* Airtime toggle */}
//                     <div className="flex items-center gap-1.5">
//                       <Smartphone size={13} style={{ color: B.textFaint }} />
//                       <span
//                         className="text-xs font-medium"
//                         style={{ color: B.textMuted }}
//                       >
//                         Airtime
//                       </span>
//                       <Toggle
//                         checked={net.airtimeEnabled}
//                         onChange={(v) =>
//                           toggleNetwork(net.code, "airtimeEnabled", v)
//                         }
//                       />
//                     </div>

//                     {/* Data toggle */}
//                     <div className="flex items-center gap-1.5">
//                       <Wifi size={13} style={{ color: B.textFaint }} />
//                       <span
//                         className="text-xs font-medium"
//                         style={{ color: B.textMuted }}
//                       >
//                         Data
//                       </span>
//                       <Toggle
//                         checked={net.dataEnabled}
//                         onChange={(v) =>
//                           toggleNetwork(net.code, "dataEnabled", v)
//                         }
//                       />
//                     </div>
//                   </div>

//                   <div className="ml-auto flex items-center gap-3">
//                     <StatusBadge active={net.isActive} />
//                     <Toggle
//                       checked={net.isActive}
//                       onChange={(v) => toggleNetwork(net.code, "isActive", v)}
//                     />
//                     <button
//                       onClick={() => startEdit(net)}
//                       className="rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition hover:bg-gray-50"
//                       style={{ borderColor: B.border, color: B.textMuted }}
//                     >
//                       <Edit2 size={13} />
//                     </button>
//                   </div>
//                 </div>
//               )}
//             </div>
//           </div>
//         </Card>
//       ))}
//       {toast && <Toast msg={toast.msg} type={toast.type} />}
//       <CreateNetworkModal
//         isOpen={isCreateModalOpen}
//         id={networks?.length.toString()}
//         onClose={() => setIsCreateModalOpen(false)}
//         onSuccess={(newNetwork) => {
//           // Optimistically append the new network to the list
//           setNetworks((prev) =>
//             [...prev, newNetwork].sort((a, b) => a.name.localeCompare(b.name)),
//           );
//           showToast(`Successfully added ${newNetwork.name}!`);
//         }}
//       />
//     </div>
//   );
// }
// // ─── Tab: Airtime Types ───────────────────────────────────────────────────────

// function AirtimeTypesTab() {
//   const [items, setItems] = useState<AirtimeTypeConfig[]>([]);
//   const [networkFilter, setNetworkFilter] = useState("all");
//   const [search, setSearch] = useState("");
//   const [showModal, setShowModal] = useState(false);
//   const [editItem, setEditItem] = useState<AirtimeTypeConfig | null>(null);
//   const [toast, setToast] = useState<{
//     msg: string;
//     type: "success" | "error" | "warn";
//   } | null>(null);

//   function showToast(
//     msg: string,
//     type: "success" | "error" | "warn" = "success",
//   ) {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3000);
//   }

//   useEffect(() => {
//     async function fetchNetworkType() {
//       try {
//         const res = await fetch(`/api/v1/networks/types`);
//         const { data } = await res.json();
//         console.log({ data });
//         setItems(data);
//       } catch (error) {}
//     }
//     fetchNetworkType();
//   }, []);

//   const filtered = items?.filter((i) => {
//     if (search && !i.name.toLowerCase().includes(search.toLowerCase()))
//       return false;
//     return true;
//   });

//   function toggleItem(id: string, val: boolean) {
//     console.log({ id });
//     updateNetworkType(id, { isActive: val }).then(() => {
//       setItems((prev) =>
//         prev.map((i) => (i.id === id ? { ...i, isActive: val } : i)),
//       );
//       showToast(`Airtime type ${val ? "enabled" : "disabled"}.`);
//     });
//   }

//   return (
//     <div className="space-y-4">
//       {/* Controls */}
//       <div className="flex flex-wrap items-center gap-2">
//         <div
//           className="flex flex-1 items-center gap-2 rounded-xl border px-3 py-2"
//           style={{ borderColor: B.border, minWidth: 180 }}
//         >
//           <Search size={14} style={{ color: B.textFaint }} />
//           <input
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//             placeholder="Search airtime types…"
//             className="flex-1 bg-transparent text-sm outline-none"
//             style={{ color: B.text }}
//           />
//         </div>
//         <select
//           value={networkFilter}
//           onChange={(e) => setNetworkFilter(e.target.value)}
//           className="rounded-xl border px-3 py-2 text-sm outline-none"
//           style={{ borderColor: B.border, color: B.text }}
//         >
//           {NETWORK_FILTER_OPTIONS.map((o) => (
//             <option key={o.value} value={o.value}>
//               {o.label}
//             </option>
//           ))}
//         </select>
//         <button
//           onClick={() => {
//             setEditItem(null);
//             setShowModal(true);
//           }}
//           className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white"
//           style={{
//             background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
//           }}
//         >
//           <Plus size={14} />
//           Add type
//         </button>
//       </div>

//       {/* Table */}
//       <Card>
//         {filtered?.length === 0 ? (
//           <EmptyState
//             icon={Smartphone}
//             title="No airtime types found"
//             subtitle="Try adjusting filters or add a new airtime type."
//             onAdd={() => setShowModal(true)}
//           />
//         ) : (
//           <div className="overflow-x-auto">
//             <table className="w-full min-w-[640px]">
//               <thead>
//                 <tr style={{ borderBottom: `1px solid ${B.border}` }}>
//                   {["Name", "Type", "Status", ""].map((h) => (
//                     <th
//                       key={h}
//                       className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide"
//                       style={{ color: B.textFaint }}
//                     >
//                       {h}
//                     </th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody className="divide-y" style={{ borderColor: B.border }}>
//                 {filtered?.map((item) => (
//                   <tr
//                     key={item.id}
//                     className="group hover:bg-gray-50 transition-colors"
//                   >
//                     <td className="px-4 py-3 ">
//                       <div
//                         className="text-sm font-medium"
//                         style={{ color: B.text }}
//                       >
//                         {item.name}
//                       </div>
//                     </td>
//                     <td className="px-4 py-3">
//                       <div className="flex items-center gap-2 text-sm">
//                         {item.type}
//                       </div>
//                     </td>
//                     <td className="px-4 py-3">
//                       <div className="flex items-center gap-2">
//                         <StatusBadge active={item.isActive} />
//                         <Toggle
//                           checked={item.isActive}
//                           onChange={(v) => toggleItem(item.id, v)}
//                         />
//                       </div>
//                     </td>
//                     <td className="px-4 py-3">
//                       <button
//                         onClick={() => {
//                           setEditItem(item);
//                           setShowModal(true);
//                         }}
//                         className="rounded-lg p-1.5 transition hover:bg-gray-100"
//                         style={{ color: B.textFaint }}
//                       >
//                         <Edit2 size={13} />
//                       </button>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </Card>

//       {/* Add/Edit Modal */}
//       {showModal && (

//       )}

//       {toast && <Toast msg={toast.msg} type={toast.type} />}
//     </div>
//   );
// }

// // ─── Tab: Airtime Discounts ───────────────────────────────────────────────────

// function AirtimeDiscountsTab() {
//   const [items, setItems] = useState<AirtimeDiscount[]>(AIRTIME_DISCOUNTS);
//   const [networkFilter, setNetworkFilter] = useState("all");
//   const [showModal, setShowModal] = useState(false);
//   const [editItem, setEditItem] = useState<AirtimeDiscount | null>(null);
//   const [toast, setToast] = useState<{
//     msg: string;
//     type: "success" | "error" | "warn";
//   } | null>(null);

//   function showToast(
//     msg: string,
//     type: "success" | "error" | "warn" = "success",
//   ) {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3000);
//   }

//   const filtered = items?.filter((i) =>
//     networkFilter === "all" ? true : i.network === networkFilter,
//   );

//   function toggleItem(id: string, val: boolean) {
//     setItems((prev) =>
//       prev.map((i) => (i.id === id ? { ...i, isActive: val } : i)),
//     );
//     showToast(`Discount ${val ? "enabled" : "disabled"}.`);
//   }

//   function deleteItem(id: string) {
//     if (!confirm("Delete this discount?")) return;
//     setItems((prev) => prev.filter((i) => i.id !== id));
//     showToast("Discount deleted.", "warn");
//   }

//   return (
//     <div className="space-y-4">
//       <div className="flex flex-wrap items-center gap-2">
//         <select
//           value={networkFilter}
//           onChange={(e) => setNetworkFilter(e.target.value)}
//           className="rounded-xl border px-3 py-2 text-sm outline-none"
//           style={{ borderColor: B.border, color: B.text }}
//         >
//           {NETWORK_FILTER_OPTIONS.map((o) => (
//             <option key={o.value} value={o.value}>
//               {o.label}
//             </option>
//           ))}
//         </select>
//         <button
//           onClick={() => {
//             setEditItem(null);
//             setShowModal(true);
//           }}
//           className="ml-auto flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white"
//           style={{
//             background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
//           }}
//         >
//           <Plus size={14} />
//           Add discount
//         </button>
//       </div>

//       <div className="grid gap-3 sm:grid-cols-2">
//         {filtered?.length === 0 ? (
//           <div className="col-span-2">
//             <Card>
//               <EmptyState
//                 icon={Percent}
//                 title="No discounts configured"
//                 onAdd={() => setShowModal(true)}
//               />
//             </Card>
//           </div>
//         ) : (
//           filtered?.map((item) => {
//             const isExpired =
//               item.validTo && new Date(item.validTo) < new Date();
//             return (
//               <Card key={item.id}>
//                 <div className="p-4">
//                   <div className="mb-3 flex items-start justify-between">
//                     <div>
//                       <p
//                         className="text-sm font-bold"
//                         style={{ color: B.text }}
//                       >
//                         {item.label}
//                       </p>
//                       <div className="mt-1 flex items-center gap-2">
//                         <NetworkBadge code={item.network} />
//                         <span
//                           className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
//                           style={{ background: B.purpleLight, color: B.purple }}
//                         >
//                           {item.type}
//                         </span>
//                       </div>
//                     </div>
//                     <div className="flex items-center gap-1.5">
//                       <StatusBadge active={item.isActive && !isExpired} />
//                     </div>
//                   </div>

//                   <div
//                     className="mb-3 flex items-center justify-center rounded-xl py-3"
//                     style={{ background: B.greenLight }}
//                   >
//                     <Percent
//                       size={18}
//                       style={{ color: B.green }}
//                       className="mr-1.5"
//                     />
//                     <span
//                       className="text-2xl font-extrabold"
//                       style={{ color: B.green }}
//                     >
//                       {item.discountPercent}%
//                     </span>
//                     <span className="ml-1.5 text-sm" style={{ color: B.green }}>
//                       off
//                     </span>
//                   </div>

//                   <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
//                     <div
//                       className="rounded-lg p-2"
//                       style={{ background: B.surface }}
//                     >
//                       <p style={{ color: B.textFaint }}>Min amount</p>
//                       <p className="font-bold" style={{ color: B.text }}>
//                         {fmt(item.minAmountKobo)}
//                       </p>
//                     </div>
//                     <div
//                       className="rounded-lg p-2"
//                       style={{ background: B.surface }}
//                     >
//                       <p style={{ color: B.textFaint }}>Valid until</p>
//                       <p
//                         className="font-bold"
//                         style={{ color: isExpired ? B.red : B.text }}
//                       >
//                         {item.validTo ?? "No expiry"}
//                       </p>
//                     </div>
//                   </div>

//                   <div
//                     className="flex items-center justify-between border-t pt-3"
//                     style={{ borderColor: B.border }}
//                   >
//                     <Toggle
//                       checked={item.isActive}
//                       onChange={(v) => toggleItem(item.id, v)}
//                     />
//                     <div className="flex items-center gap-1.5">
//                       <button
//                         onClick={() => {
//                           setEditItem(item);
//                           setShowModal(true);
//                         }}
//                         className="rounded-lg p-1.5 transition hover:bg-gray-100"
//                         style={{ color: B.textFaint }}
//                       >
//                         <Edit2 size={13} />
//                       </button>
//                       <button
//                         onClick={() => deleteItem(item.id)}
//                         className="rounded-lg p-1.5 transition hover:bg-red-50"
//                         style={{ color: B.red }}
//                       >
//                         <Trash2 size={13} />
//                       </button>
//                     </div>
//                   </div>
//                 </div>
//               </Card>
//             );
//           })
//         )}
//       </div>

//       {showModal && (
//         <DiscountModal
//           item={editItem}
//           onClose={() => setShowModal(false)}
//           onSave={(data) => {
//             if (editItem) {
//               setItems((prev) =>
//                 prev.map((i) => (i.id === editItem.id ? { ...i, ...data } : i)),
//               );
//               showToast("Discount updated.");
//             } else {
//               setItems((prev) => [
//                 ...prev,
//                 {
//                   ...data,
//                   id: `ad${Date.now()}`,
//                   validFrom: new Date().toISOString().slice(0, 10),
//                 } as AirtimeDiscount,
//               ]);
//               showToast("Discount added.");
//             }
//             setShowModal(false);
//           }}
//         />
//       )}

//       {toast && <Toast msg={toast.msg} type={toast.type} />}
//     </div>
//   );
// }

// function DiscountModal({
//   item,
//   onClose,
//   onSave,
// }: {
//   item: AirtimeDiscount | null;
//   onClose: () => void;
//   onSave: (data: Partial<AirtimeDiscount>) => void;
// }) {
//   const [form, setForm] = useState<Partial<AirtimeDiscount>>(
//     item ?? {
//       type: "airtime",
//       name: "",
//       isActive: true,
//     },
//   );
//   const [saving, setSaving] = useState(false);

//   async function submit() {
//     setSaving(true);
//     await new Promise((r) => setTimeout(r, 600));
//     onSave(form);
//     setSaving(false);
//   }

//   return (
//     <div
//       className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
//       onClick={onClose}
//     >
//       <div
//         className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
//         style={{ border: `1px solid ${B.border}` }}
//         onClick={(e) => e.stopPropagation()}
//       >
//         <h2 className="mb-4 text-base font-bold" style={{ color: B.text }}>
//           {item ? "Edit discount" : "Add airtime discount"}
//         </h2>

//         <div className="space-y-3">
//           <div className="grid grid-cols-2 gap-3">
//             <div>
//               <label
//                 className="mb-1 block text-xs font-semibold"
//                 style={{ color: B.textMuted }}
//               >
//                 Network
//               </label>
//               <select
//                 value={form.network}
//                 onChange={(e) =>
//                   setForm((f) => ({
//                     ...f,
//                     network: e.target.value as NetworkId,
//                   }))
//                 }
//                 className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
//                 style={{ borderColor: B.border, color: B.text }}
//               >
//                 {NETWORKS.map((n) => (
//                   <option key={n.code} value={n.code}>
//                     {n.name}
//                   </option>
//                 ))}
//               </select>
//             </div>
//             <div>
//               <label
//                 className="mb-1 block text-xs font-semibold"
//                 style={{ color: B.textMuted }}
//               >
//                 Type
//               </label>
//               <select
//                 value={form.type}
//                 onChange={(e) =>
//                   setForm((f) => ({
//                     ...f,
//                     type: e.target.value as AirtimeType,
//                   }))
//                 }
//                 className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
//                 style={{ borderColor: B.border, color: B.text }}
//               >
//                 {([] as AirtimeType[]).map((t) => (
//                   <option key={t} value={t}>
//                     {t}
//                   </option>
//                 ))}
//               </select>
//             </div>
//           </div>

//           <div>
//             <label
//               className="mb-1 block text-xs font-semibold"
//               style={{ color: B.textMuted }}
//             >
//               Label
//             </label>
//             <input
//               value={form.label ?? ""}
//               onChange={(e) =>
//                 setForm((f) => ({ ...f, label: e.target.value }))
//               }
//               placeholder="e.g. MTN VTU Standard Discount"
//               className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
//               style={{ borderColor: B.border, color: B.text }}
//             />
//           </div>

//           <div className="grid grid-cols-2 gap-3">
//             <div>
//               <label
//                 className="mb-1 block text-xs font-semibold"
//                 style={{ color: B.textMuted }}
//               >
//                 Discount %
//               </label>
//               <input
//                 type="number"
//                 step="0.5"
//                 min="0"
//                 max="100"
//                 value={form.discountPercent ?? 0}
//                 onChange={(e) =>
//                   setForm((f) => ({
//                     ...f,
//                     discountPercent: Number(e.target.value),
//                   }))
//                 }
//                 className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
//                 style={{ borderColor: B.border, color: B.text }}
//               />
//             </div>
//             <div>
//               <label
//                 className="mb-1 block text-xs font-semibold"
//                 style={{ color: B.textMuted }}
//               >
//                 Min amount (₦)
//               </label>
//               <input
//                 type="number"
//                 value={(form.minAmountKobo ?? 0) / 100}
//                 onChange={(e) =>
//                   setForm((f) => ({
//                     ...f,
//                     minAmountKobo: Number(e.target.value) * 100,
//                   }))
//                 }
//                 className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
//                 style={{ borderColor: B.border, color: B.text }}
//               />
//             </div>
//           </div>

//           <div>
//             <label
//               className="mb-1 block text-xs font-semibold"
//               style={{ color: B.textMuted }}
//             >
//               Expiry date (optional)
//             </label>
//             <input
//               type="date"
//               value={form.validTo ?? ""}
//               onChange={(e) =>
//                 setForm((f) => ({ ...f, validTo: e.target.value || null }))
//               }
//               className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
//               style={{ borderColor: B.border, color: B.text }}
//             />
//           </div>
//         </div>

//         <div className="mt-5 flex gap-3">
//           <button
//             onClick={onClose}
//             className="flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold"
//             style={{ border: `1.5px solid ${B.border}`, color: B.text }}
//           >
//             Cancel
//           </button>
//           <button
//             onClick={submit}
//             disabled={saving || !form.label}
//             className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
//             style={{
//               background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
//             }}
//           >
//             {saving && <Loader2 size={14} className="animate-spin" />}
//             {saving ? "Saving…" : item ? "Save changes" : "Add discount"}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ─── Tab: Data Types ──────────────────────────────────────────────────────────

// function DataTypesTab() {
//   const [items, setItems] = useState<DataType[]>(DATA_TYPES);
//   const [networkFilter, setNetworkFilter] = useState("all");
//   const [showModal, setShowModal] = useState(false);
//   const [editItem, setEditItem] = useState<DataType | null>(null);
//   const [toast, setToast] = useState<{
//     msg: string;
//     type: "success" | "error" | "warn";
//   } | null>(null);

//   function showToast(
//     msg: string,
//     type: "success" | "error" | "warn" = "success",
//   ) {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3000);
//   }

//   const filtered = items?.filter((i) =>
//     networkFilter === "all" ? true : i.network === networkFilter,
//   );

//   const CATEGORIES: DataCategory[] = ["SME", "Gifting", "Corporate", "Direct"];
//   const catColors: Record<DataCategory, { color: string; bg: string }> = {
//     SME: { color: B.blue, bg: B.blueLight },
//     Gifting: { color: B.green, bg: B.greenLight },
//     Corporate: { color: B.purple, bg: B.purpleLight },
//     Direct: { color: B.amber, bg: B.amberLight },
//   };

//   return (
//     <div className="space-y-4">
//       <div className="flex flex-wrap items-center gap-2">
//         <select
//           value={networkFilter}
//           onChange={(e) => setNetworkFilter(e.target.value)}
//           className="rounded-xl border px-3 py-2 text-sm outline-none"
//           style={{ borderColor: B.border, color: B.text }}
//         >
//           {NETWORK_FILTER_OPTIONS.map((o) => (
//             <option key={o.value} value={o.value}>
//               {o.label}
//             </option>
//           ))}
//         </select>
//         <button
//           onClick={() => {
//             setEditItem(null);
//             setShowModal(true);
//           }}
//           className="ml-auto flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white"
//           style={{
//             background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
//           }}
//         >
//           <Plus size={14} />
//           Add data type
//         </button>
//       </div>

//       <Card>
//         {filtered?.length === 0 ? (
//           <EmptyState
//             icon={Wifi}
//             title="No data types configured"
//             onAdd={() => setShowModal(true)}
//           />
//         ) : (
//           <div className="overflow-x-auto">
//             <table className="w-full min-w-[600px]">
//               <thead>
//                 <tr style={{ borderBottom: `1px solid ${B.border}` }}>
//                   {[
//                     "Network",
//                     "Category",
//                     "Label",
//                     "Description",
//                     "Status",
//                     "",
//                   ].map((h) => (
//                     <th
//                       key={h}
//                       className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide"
//                       style={{ color: B.textFaint }}
//                     >
//                       {h}
//                     </th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody className="divide-y" style={{ borderColor: B.border }}>
//                 {filtered?.map((item) => {
//                   const cat = catColors[item.category] ?? {
//                     color: B.textFaint,
//                     bg: B.surface,
//                   };
//                   return (
//                     <tr
//                       key={item.id}
//                       className="group hover:bg-gray-50 transition-colors"
//                     >
//                       <td className="px-4 py-3">
//                         <NetworkBadge code={item.network} />
//                       </td>
//                       <td className="px-4 py-3">
//                         <span
//                           className="rounded-lg px-2 py-0.5 text-xs font-bold"
//                           style={{ background: cat.bg, color: cat.color }}
//                         >
//                           {item.category}
//                         </span>
//                       </td>
//                       <td
//                         className="px-4 py-3 text-sm font-medium"
//                         style={{ color: B.text }}
//                       >
//                         {item.label}
//                       </td>
//                       <td
//                         className="max-w-xs truncate px-4 py-3 text-xs"
//                         style={{ color: B.textMuted }}
//                       >
//                         {item.description}
//                       </td>
//                       <td className="px-4 py-3">
//                         <div className="flex items-center gap-2">
//                           <StatusBadge active={item.isActive} />
//                           <Toggle
//                             checked={item.isActive}
//                             onChange={(v) => {
//                               setItems((prev) =>
//                                 prev.map((i) =>
//                                   i.id === item.id ? { ...i, isActive: v } : i,
//                                 ),
//                               );
//                               showToast(
//                                 `Data type ${v ? "enabled" : "disabled"}.`,
//                               );
//                             }}
//                           />
//                         </div>
//                       </td>
//                       <td className="px-4 py-3">
//                         <button
//                           onClick={() => {
//                             setEditItem(item);
//                             setShowModal(true);
//                           }}
//                           className="rounded-lg p-1.5 transition hover:bg-gray-100"
//                           style={{ color: B.textFaint }}
//                         >
//                           <Edit2 size={13} />
//                         </button>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </Card>

//       {showModal && (
//         <DataTypeModal
//           item={editItem}
//           onClose={() => setShowModal(false)}
//           onSave={(data) => {
//             if (editItem) {
//               setItems((prev) =>
//                 prev.map((i) => (i.id === editItem.id ? { ...i, ...data } : i)),
//               );
//               showToast("Data type updated.");
//             } else {
//               setItems((prev) => [
//                 ...prev,
//                 { ...data, id: `dt${Date.now()}` } as DataType,
//               ]);
//               showToast("Data type added.");
//             }
//             setShowModal(false);
//           }}
//           categories={CATEGORIES}
//         />
//       )}

//       {toast && <Toast msg={toast.msg} type={toast.type} />}
//     </div>
//   );
// }

// function DataTypeModal({
//   item,
//   onClose,
//   onSave,
//   categories,
// }: {
//   item: DataType | null;
//   onClose: () => void;
//   onSave: (data: Partial<DataType>) => void;
//   categories: DataCategory[];
// }) {
//   const [form, setForm] = useState<Partial<DataType>>(
//     item ?? {
//       network: "mtn",
//       category: "SME",
//       label: "",
//       isActive: true,
//       description: "",
//     },
//   );
//   const [saving, setSaving] = useState(false);

//   async function submit() {
//     setSaving(true);
//     await new Promise((r) => setTimeout(r, 600));
//     onSave(form);
//     setSaving(false);
//   }

//   return (
//     <div
//       className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
//       onClick={onClose}
//     >
//       <div
//         className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
//         style={{ border: `1px solid ${B.border}` }}
//         onClick={(e) => e.stopPropagation()}
//       >
//         <h2 className="mb-4 text-base font-bold" style={{ color: B.text }}>
//           {item ? "Edit data type" : "Add data type"}
//         </h2>

//         <div className="space-y-3">
//           <div className="grid grid-cols-2 gap-3">
//             <div>
//               <label
//                 className="mb-1 block text-xs font-semibold"
//                 style={{ color: B.textMuted }}
//               >
//                 Network
//               </label>
//               <select
//                 value={form.network}
//                 onChange={(e) =>
//                   setForm((f) => ({
//                     ...f,
//                     network: e.target.value as NetworkId,
//                   }))
//                 }
//                 className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
//                 style={{ borderColor: B.border, color: B.text }}
//               >
//                 {NETWORKS.map((n) => (
//                   <option key={n.code} value={n.code}>
//                     {n.name}
//                   </option>
//                 ))}
//               </select>
//             </div>
//             <div>
//               <label
//                 className="mb-1 block text-xs font-semibold"
//                 style={{ color: B.textMuted }}
//               >
//                 Category
//               </label>
//               <select
//                 value={form.category}
//                 onChange={(e) =>
//                   setForm((f) => ({
//                     ...f,
//                     category: e.target.value as DataCategory,
//                   }))
//                 }
//                 className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
//                 style={{ borderColor: B.border, color: B.text }}
//               >
//                 {categories.map((c) => (
//                   <option key={c} value={c}>
//                     {c}
//                   </option>
//                 ))}
//               </select>
//             </div>
//           </div>

//           <div>
//             <label
//               className="mb-1 block text-xs font-semibold"
//               style={{ color: B.textMuted }}
//             >
//               Label
//             </label>
//             <input
//               value={form.label ?? ""}
//               onChange={(e) =>
//                 setForm((f) => ({ ...f, label: e.target.value }))
//               }
//               placeholder="e.g. MTN SME Data"
//               className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
//               style={{ borderColor: B.border, color: B.text }}
//             />
//           </div>

//           <div>
//             <label
//               className="mb-1 block text-xs font-semibold"
//               style={{ color: B.textMuted }}
//             >
//               Description
//             </label>
//             <textarea
//               value={form.description ?? ""}
//               onChange={(e) =>
//                 setForm((f) => ({ ...f, description: e.target.value }))
//               }
//               placeholder="Brief description of this data type…"
//               rows={2}
//               className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
//               style={{ borderColor: B.border, color: B.text }}
//             />
//           </div>

//           <div
//             className="flex items-center justify-between rounded-xl p-3"
//             style={{ background: B.surface }}
//           >
//             <span className="text-sm font-medium" style={{ color: B.text }}>
//               Active
//             </span>
//             <Toggle
//               checked={form.isActive ?? true}
//               onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
//             />
//           </div>
//         </div>

//         <div className="mt-5 flex gap-3">
//           <button
//             onClick={onClose}
//             className="flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold"
//             style={{ border: `1.5px solid ${B.border}`, color: B.text }}
//           >
//             Cancel
//           </button>
//           <button
//             onClick={submit}
//             disabled={saving || !form.label}
//             className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
//             style={{
//               background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
//             }}
//           >
//             {saving && <Loader2 size={14} className="animate-spin" />}
//             {saving ? "Saving…" : item ? "Save changes" : "Add type"}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ─── Tab: Data Plans ──────────────────────────────────────────────────────────

// function DataPlansTab() {
//   const [plans, setPlans] = useState<DataPlan[]>(DATA_PLANS);
//   const [networkFilter, setNetworkFilter] = useState("all");
//   const [catFilter, setCatFilter] = useState("all");
//   const [search, setSearch] = useState("");
//   const [showModal, setShowModal] = useState(false);
//   const [editPlan, setEditPlan] = useState<DataPlan | null>(null);
//   const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
//   const [editingPrice, setEditingPrice] = useState("");
//   const [toast, setToast] = useState<{
//     msg: string;
//     type: "success" | "error" | "warn";
//   } | null>(null);

//   function showToast(
//     msg: string,
//     type: "success" | "error" | "warn" = "success",
//   ) {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3000);
//   }

//   const filtered = plans?.filter((p) => {
//     if (networkFilter !== "all" && p.network !== networkFilter) return false;
//     if (catFilter !== "all" && p.category !== catFilter) return false;
//     if (
//       search &&
//       !p.name.toLowerCase().includes(search.toLowerCase()) &&
//       !p.size.toLowerCase().includes(search.toLowerCase())
//     )
//       return false;
//     return true;
//   });

//   function savePrice(id: string) {
//     const kobo = Math.round(parseFloat(editingPrice) * 100);
//     if (isNaN(kobo) || kobo <= 0) return;
//     setPlans((prev) =>
//       prev.map((p) => (p.id === id ? { ...p, sellPriceKobo: kobo } : p)),
//     );
//     setEditingPriceId(null);
//     showToast("Price updated.");
//   }

//   return (
//     <div className="space-y-4">
//       {/* Stats */}
//       <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
//         {[
//           {
//             label: "Total plans",
//             value: plans?.length,
//             color: B.blue,
//             bg: B.blueLight,
//           },
//           {
//             label: "Active",
//             value: plans?.filter((p) => p.isActive).length,
//             color: B.green,
//             bg: B.greenLight,
//           },
//           {
//             label: "Margin issues",
//             value: plans?.filter((p) => p.costPriceKobo > p.sellPriceKobo)
//               .length,
//             color: B.red,
//             bg: B.redLight,
//           },
//           {
//             label: "Networks covered",
//             value: new Set(plans?.map((p) => p.network)).size,
//             color: B.amber,
//             bg: B.amberLight,
//           },
//         ].map((s) => (
//           <div
//             key={s.label}
//             className="rounded-2xl p-4"
//             style={{ background: s.bg, border: `1px solid ${s.color}20` }}
//           >
//             <p className="text-xl font-extrabold" style={{ color: s.color }}>
//               {s.value}
//             </p>
//             <p className="text-xs font-semibold" style={{ color: s.color }}>
//               {s.label}
//             </p>
//           </div>
//         ))}
//       </div>

//       {/* Filters */}
//       <div className="flex flex-wrap items-center gap-2">
//         <div
//           className="flex flex-1 items-center gap-2 rounded-xl border px-3 py-2"
//           style={{ borderColor: B.border, minWidth: 160 }}
//         >
//           <Search size={14} style={{ color: B.textFaint }} />
//           <input
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//             placeholder="Search plans…"
//             className="flex-1 bg-transparent text-sm outline-none"
//             style={{ color: B.text }}
//           />
//         </div>
//         <select
//           value={networkFilter}
//           onChange={(e) => setNetworkFilter(e.target.value)}
//           className="rounded-xl border px-3 py-2 text-sm outline-none"
//           style={{ borderColor: B.border, color: B.text }}
//         >
//           {NETWORK_FILTER_OPTIONS.map((o) => (
//             <option key={o.value} value={o.value}>
//               {o.label}
//             </option>
//           ))}
//         </select>
//         <select
//           value={catFilter}
//           onChange={(e) => setCatFilter(e.target.value)}
//           className="rounded-xl border px-3 py-2 text-sm outline-none"
//           style={{ borderColor: B.border, color: B.text }}
//         >
//           <option value="all">All categories</option>
//           {(["SME", "Gifting", "Corporate", "Direct"] as DataCategory[]).map(
//             (c) => (
//               <option key={c} value={c}>
//                 {c}
//               </option>
//             ),
//           )}
//         </select>
//         <button
//           onClick={() => {
//             setEditPlan(null);
//             setShowModal(true);
//           }}
//           className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white"
//           style={{
//             background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
//           }}
//         >
//           <Plus size={14} />
//           Add plan
//         </button>
//       </div>

//       {/* Table */}
//       <Card className="overflow-hidden">
//         {filtered?.length === 0 ? (
//           <EmptyState
//             icon={Database}
//             title="No data plans found"
//             subtitle="Try adjusting filters or add a new plan?."
//             onAdd={() => setShowModal(true)}
//           />
//         ) : (
//           <div className="overflow-x-auto">
//             <table className="w-full min-w-[780px]">
//               <thead>
//                 <tr style={{ borderBottom: `1px solid ${B.border}` }}>
//                   {[
//                     "Network",
//                     "Category",
//                     "Plan",
//                     "Size",
//                     "Validity",
//                     "Cost",
//                     "Sell price",
//                     "Margin",
//                     "Status",
//                     "",
//                   ].map((h) => (
//                     <th
//                       key={h}
//                       className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide"
//                       style={{ color: B.textFaint }}
//                     >
//                       {h}
//                     </th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody className="divide-y" style={{ borderColor: B.border }}>
//                 {filtered?.map((plan) => {
//                   const margin = marginPct(
//                     plan?.costPriceKobo,
//                     plan?.sellPriceKobo,
//                   );
//                   const marginBreach = plan?.costPriceKobo > plan?.sellPriceKobo;

//                   return (
//                     <tr
//                       key={plan?.id}
//                       className="group hover:bg-gray-50 transition-colors"
//                     >
//                       <td className="px-4 py-3">
//                         <NetworkBadge code={plan?.network} />
//                       </td>
//                       <td className="px-4 py-3">
//                         <span
//                           className="rounded-md px-1.5 py-0.5 text-[11px] font-bold"
//                           style={{ background: B.blueLight, color: B.blue }}
//                         >
//                           {plan?.category}
//                         </span>
//                       </td>
//                       <td
//                         className="px-4 py-3 text-sm font-semibold"
//                         style={{ color: B.text }}
//                       >
//                         {plan?.name}
//                       </td>
//                       <td
//                         className="px-4 py-3 text-sm font-bold"
//                         style={{ color: B.orange }}
//                       >
//                         {plan?.size}
//                       </td>
//                       <td
//                         className="px-4 py-3 text-xs"
//                         style={{ color: B.textMuted }}
//                       >
//                         {plan?.validity}
//                       </td>
//                       <td
//                         className="px-4 py-3 text-sm"
//                         style={{ color: B.textMuted }}
//                       >
//                         {plan?.costPriceKobo ? fmt(plan?.costPriceKobo) : "—"}
//                       </td>
//                       {/* Inline sell price editor */}
//                       <td className="px-4 py-3">
//                         {editingPriceId === plan?.id ? (
//                           <div className="flex items-center gap-1">
//                             <span
//                               className="text-xs"
//                               style={{ color: B.textFaint }}
//                             >
//                               ₦
//                             </span>
//                             <input
//                               autoFocus
//                               type="number"
//                               value={editingPrice}
//                               onChange={(e) => setEditingPrice(e.target.value)}
//                               onKeyDown={(e) => {
//                                 if (e.key === "Enter") savePrice(plan?.id);
//                                 if (e.key === "Escape") setEditingPriceId(null);
//                               }}
//                               className="w-20 rounded-lg border px-1.5 py-1 text-sm font-bold outline-none"
//                               style={{ borderColor: B.orange }}
//                             />
//                             <button
//                               onClick={() => savePrice(plan?.id)}
//                               className="flex h-6 w-6 items-center justify-center rounded-lg"
//                               style={{ background: B.green, color: "#fff" }}
//                             >
//                               <Check size={11} />
//                             </button>
//                             <button
//                               onClick={() => setEditingPriceId(null)}
//                               className="flex h-6 w-6 items-center justify-center rounded-lg"
//                               style={{ background: B.redLight, color: B.red }}
//                             >
//                               <X size={11} />
//                             </button>
//                           </div>
//                         ) : (
//                           <div className="flex items-center gap-1.5">
//                             <span
//                               className="text-sm font-bold"
//                               style={{ color: B.text }}
//                             >
//                               {fmt(plan?.sellPriceKobo)}
//                             </span>
//                             <button
//                               onClick={() => {
//                                 setEditingPriceId(plan?.id);
//                                 setEditingPrice(
//                                   String(plan?.sellPriceKobo / 100),
//                                 );
//                               }}
//                               className="rounded-md p-1 opacity-0 transition hover:bg-gray-100 group-hover:opacity-100"
//                               style={{ color: B.textFaint }}
//                             >
//                               <Edit2 size={11} />
//                             </button>
//                           </div>
//                         )}
//                       </td>
//                       <td className="px-4 py-3">
//                         {margin !== null ? (
//                           <span
//                             className="rounded-lg px-2 py-0.5 text-xs font-bold"
//                             style={{
//                               background: marginBreach
//                                 ? B.redLight
//                                 : B.greenLight,
//                               color: marginBreach ? B.red : B.green,
//                             }}
//                           >
//                             {marginBreach ? "−" : "+"}
//                             {Math.abs(Number(margin))}%
//                           </span>
//                         ) : (
//                           <span
//                             className="text-xs italic"
//                             style={{ color: B.textFaint }}
//                           >
//                             —
//                           </span>
//                         )}
//                       </td>
//                       <td className="px-4 py-3">
//                         <div className="flex items-center gap-2">
//                           <StatusBadge active={plan?.isActive} />
//                           <Toggle
//                             checked={plan?.isActive}
//                             onChange={(v) => {
//                               setPlans((prev) =>
//                                 prev.map((p) =>
//                                   p.id === plan?.id ? { ...p, isActive: v } : p,
//                                 ),
//                               );
//                               showToast(`Plan ${v ? "enabled" : "disabled"}.`);
//                             }}
//                           />
//                         </div>
//                       </td>
//                       <td className="px-4 py-3">
//                         <button
//                           onClick={() => {
//                             setEditPlan(plan);
//                             setShowModal(true);
//                           }}
//                           className="rounded-lg p-1.5 transition hover:bg-gray-100"
//                           style={{ color: B.textFaint }}
//                         >
//                           <Edit2 size={13} />
//                         </button>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </Card>

//       {showModal && (
//         <DataPlanModal
//           plan={editPlan}
//           onClose={() => setShowModal(false)}
//           onSave={(data) => {
//             if (editPlan) {
//               setPlans((prev) =>
//                 prev.map((p) => (p.id === editplan?.id ? { ...p, ...data } : p)),
//               );
//               showToast("Plan updated.");
//             } else {
//               setPlans((prev) => [
//                 ...prev,
//                 { ...data, id: `dp${Date.now()}` } as DataPlan,
//               ]);
//               showToast("Plan added.");
//             }
//             setShowModal(false);
//           }}
//         />
//       )}

//       {toast && <Toast msg={toast.msg} type={toast.type} />}
//     </div>
//   );
// }

// function DataPlanModal({
//   plan,
//   onClose,
//   onSave,
// }: {
//   plan: DataPlan | null;
//   onClose: () => void;
//   onSave: (data: Partial<DataPlan>) => void;
// }) {
//   const [form, setForm] = useState<Partial<DataPlan>>(
//     plan ?? {
//       network: "mtn",
//       category: "SME",
//       name: "",
//       size: "",
//       validity: "30 Days",
//       costPriceKobo: 0,
//       sellPriceKobo: 0,
//       providerPlanId: "",
//       isActive: true,
//     },
//   );
//   const [saving, setSaving] = useState(false);

//   async function submit() {
//     setSaving(true);
//     await new Promise((r) => setTimeout(r, 600));
//     onSave(form);
//     setSaving(false);
//   }

//   return (
//     <div
//       className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
//       onClick={onClose}
//     >
//       <div
//         className="my-8 w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
//         style={{ border: `1px solid ${B.border}` }}
//         onClick={(e) => e.stopPropagation()}
//       >
//         <h2 className="mb-4 text-base font-bold" style={{ color: B.text }}>
//           {plan ? "Edit data plan" : "Add data plan"}
//         </h2>

//         <div className="space-y-3">
//           <div className="grid grid-cols-2 gap-3">
//             <div>
//               <label
//                 className="mb-1 block text-xs font-semibold"
//                 style={{ color: B.textMuted }}
//               >
//                 Network
//               </label>
//               <select
//                 value={form.network}
//                 onChange={(e) =>
//                   setForm((f) => ({
//                     ...f,
//                     network: e.target.value as NetworkId,
//                   }))
//                 }
//                 className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
//                 style={{ borderColor: B.border, color: B.text }}
//               >
//                 {NETWORKS.map((n) => (
//                   <option key={n.code} value={n.code}>
//                     {n.name}
//                   </option>
//                 ))}
//               </select>
//             </div>
//             <div>
//               <label
//                 className="mb-1 block text-xs font-semibold"
//                 style={{ color: B.textMuted }}
//               >
//                 Category
//               </label>
//               <select
//                 value={form.category}
//                 onChange={(e) =>
//                   setForm((f) => ({
//                     ...f,
//                     category: e.target.value as DataCategory,
//                   }))
//                 }
//                 className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
//                 style={{ borderColor: B.border, color: B.text }}
//               >
//                 {(
//                   ["SME", "Gifting", "Corporate", "Direct"] as DataCategory[]
//                 ).map((c) => (
//                   <option key={c} value={c}>
//                     {c}
//                   </option>
//                 ))}
//               </select>
//             </div>
//           </div>

//           <div className="grid grid-cols-2 gap-3">
//             <div>
//               <label
//                 className="mb-1 block text-xs font-semibold"
//                 style={{ color: B.textMuted }}
//               >
//                 Name
//               </label>
//               <input
//                 value={form.name ?? ""}
//                 onChange={(e) =>
//                   setForm((f) => ({ ...f, name: e.target.value }))
//                 }
//                 placeholder="e.g. 1GB SME"
//                 className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
//                 style={{ borderColor: B.border, color: B.text }}
//               />
//             </div>
//             <div>
//               <label
//                 className="mb-1 block text-xs font-semibold"
//                 style={{ color: B.textMuted }}
//               >
//                 Size
//               </label>
//               <input
//                 value={form.size ?? ""}
//                 onChange={(e) =>
//                   setForm((f) => ({ ...f, size: e.target.value }))
//                 }
//                 placeholder="e.g. 1GB"
//                 className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
//                 style={{ borderColor: B.border, color: B.text }}
//               />
//             </div>
//           </div>

//           <div>
//             <label
//               className="mb-1 block text-xs font-semibold"
//               style={{ color: B.textMuted }}
//             >
//               Validity
//             </label>
//             <input
//               value={form.validity ?? ""}
//               onChange={(e) =>
//                 setForm((f) => ({ ...f, validity: e.target.value }))
//               }
//               placeholder="e.g. 30 Days"
//               className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
//               style={{ borderColor: B.border, color: B.text }}
//             />
//           </div>

//           <div className="grid grid-cols-2 gap-3">
//             <div>
//               <label
//                 className="mb-1 block text-xs font-semibold"
//                 style={{ color: B.textMuted }}
//               >
//                 Cost price (₦)
//               </label>
//               <input
//                 type="number"
//                 value={(form.costPriceKobo ?? 0) / 100}
//                 onChange={(e) =>
//                   setForm((f) => ({
//                     ...f,
//                     costPriceKobo: Number(e.target.value) * 100,
//                   }))
//                 }
//                 className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
//                 style={{ borderColor: B.border, color: B.text }}
//               />
//             </div>
//             <div>
//               <label
//                 className="mb-1 block text-xs font-semibold"
//                 style={{ color: B.textMuted }}
//               >
//                 Sell price (₦)
//               </label>
//               <input
//                 type="number"
//                 value={(form.sellPriceKobo ?? 0) / 100}
//                 onChange={(e) =>
//                   setForm((f) => ({
//                     ...f,
//                     sellPriceKobo: Number(e.target.value) * 100,
//                   }))
//                 }
//                 className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
//                 style={{ borderColor: B.border, color: B.text }}
//               />
//             </div>
//           </div>

//           <div>
//             <label
//               className="mb-1 block text-xs font-semibold"
//               style={{ color: B.textMuted }}
//             >
//               Provider plan ID
//             </label>
//             <input
//               value={form.providerPlanId ?? ""}
//               onChange={(e) =>
//                 setForm((f) => ({ ...f, providerPlanId: e.target.value }))
//               }
//               placeholder="e.g. mtn-sme-1gb"
//               className="w-full rounded-xl border px-3 py-2 text-sm font-mono outline-none"
//               style={{ borderColor: B.border, color: B.text }}
//             />
//           </div>
//         </div>

//         <div className="mt-5 flex gap-3">
//           <button
//             onClick={onClose}
//             className="flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold"
//             style={{ border: `1.5px solid ${B.border}`, color: B.text }}
//           >
//             Cancel
//           </button>
//           <button
//             onClick={submit}
//             disabled={saving || !form.name || !form.size}
//             className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
//             style={{
//               background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
//             }}
//           >
//             {saving && <Loader2 size={14} className="animate-spin" />}
//             {saving ? "Saving…" : plan ? "Save changes" : "Add plan"}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ─── Tab: PIN Configs ─────────────────────────────────────────────────────────

// function PinTab({ type }: { type: "airtime" | "data" }) {
//   const [items, setItems] = useState<PinConfig[]>(
//     PIN_CONFIGS.filter((p) => p.type === type),
//   );
//   const [networkFilter, setNetworkFilter] = useState("all");
//   const [showModal, setShowModal] = useState(false);
//   const [editItem, setEditItem] = useState<PinConfig | null>(null);
//   const [copiedId, setCopiedId] = useState<string | null>(null);
//   const [showPin, setShowPin] = useState<Record<string, boolean>>({});
//   const [toast, setToast] = useState<{
//     msg: string;
//     type: "success" | "error" | "warn";
//   } | null>(null);

//   function showToast(msg: string, t: "success" | "error" | "warn" = "success") {
//     setToast({ msg, type: t });
//     setTimeout(() => setToast(null), 3000);
//   }

//   function copyPin(id: string, pin: string) {
//     navigator.clipboard.writeText(pin).then(() => {
//       setCopiedId(id);
//       setTimeout(() => setCopiedId(null), 2000);
//       showToast("Copied to clipboard!");
//     });
//   }

//   const filtered = items?.filter((i) =>
//     networkFilter === "all" ? true : i.network === networkFilter,
//   );

//   return (
//     <div className="space-y-4">
//       <div className="flex flex-wrap items-center gap-2">
//         <select
//           value={networkFilter}
//           onChange={(e) => setNetworkFilter(e.target.value)}
//           className="rounded-xl border px-3 py-2 text-sm outline-none"
//           style={{ borderColor: B.border, color: B.text }}
//         >
//           {NETWORK_FILTER_OPTIONS.map((o) => (
//             <option key={o.value} value={o.value}>
//               {o.label}
//             </option>
//           ))}
//         </select>
//         <button
//           onClick={() => {
//             setEditItem(null);
//             setShowModal(true);
//           }}
//           className="ml-auto flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white"
//           style={{
//             background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
//           }}
//         >
//           <Plus size={14} />
//           Add {type} PIN
//         </button>
//       </div>

//       <div className="grid gap-3 sm:grid-cols-2">
//         {filtered?.length === 0 ? (
//           <div className="col-span-2">
//             <Card>
//               <EmptyState
//                 icon={Key}
//                 title={`No ${type} PINs configured`}
//                 onAdd={() => setShowModal(true)}
//               />
//             </Card>
//           </div>
//         ) : (
//           filtered?.map((item) => (
//             <Card key={item.id}>
//               <div className="p-4">
//                 <div className="mb-3 flex items-center justify-between">
//                   <div className="flex items-center gap-2">
//                     <NetworkBadge code={item.network} />
//                     <StatusBadge active={item.isActive} />
//                   </div>
//                   <div className="flex items-center gap-1.5">
//                     <Toggle
//                       checked={item.isActive}
//                       onChange={(v) => {
//                         setItems((prev) =>
//                           prev.map((i) =>
//                             i.id === item.id ? { ...i, isActive: v } : i,
//                           ),
//                         );
//                         showToast(`PIN ${v ? "enabled" : "disabled"}.`);
//                       }}
//                     />
//                     <button
//                       onClick={() => {
//                         setEditItem(item);
//                         setShowModal(true);
//                       }}
//                       className="rounded-lg p-1.5 transition hover:bg-gray-100"
//                       style={{ color: B.textFaint }}
//                     >
//                       <Edit2 size={13} />
//                     </button>
//                   </div>
//                 </div>

//                 <p className="mb-3 text-sm font-bold" style={{ color: B.text }}>
//                   {item.label}
//                 </p>

//                 {/* PIN field */}
//                 <div
//                   className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2.5"
//                   style={{
//                     background: B.surface,
//                     border: `1px solid ${B.border}`,
//                   }}
//                 >
//                   <Key
//                     size={14}
//                     style={{ color: B.orange }}
//                     className="shrink-0"
//                   />
//                   <span
//                     className="flex-1 font-mono text-sm font-bold tracking-wider"
//                     style={{ color: B.text }}
//                   >
//                     {showPin[item.id] ? item.pin : "••••••••"}
//                   </span>
//                   <button
//                     onClick={() =>
//                       setShowPin((s) => ({ ...s, [item.id]: !s[item.id] }))
//                     }
//                     className="rounded p-1"
//                     style={{ color: B.textFaint }}
//                   >
//                     {showPin[item.id] ? (
//                       <EyeOff size={13} />
//                     ) : (
//                       <Eye size={13} />
//                     )}
//                   </button>
//                   <button
//                     onClick={() => copyPin(item.id, item.pin)}
//                     className="rounded p-1"
//                     style={{
//                       color: copiedId === item.id ? B.green : B.textFaint,
//                     }}
//                   >
//                     {copiedId === item.id ? (
//                       <Check size={13} />
//                     ) : (
//                       <Copy size={13} />
//                     )}
//                   </button>
//                 </div>

//                 {/* USSD */}
//                 <div
//                   className="flex items-center gap-2 rounded-xl px-3 py-2"
//                   style={{ background: B.blueLight }}
//                 >
//                   <Zap
//                     size={12}
//                     style={{ color: B.blue }}
//                     className="shrink-0"
//                   />
//                   <span
//                     className="font-mono text-xs font-semibold"
//                     style={{ color: B.blue }}
//                   >
//                     USSD: {item.ussdCode}
//                   </span>
//                 </div>

//                 {item.notes && (
//                   <p className="mt-2 text-xs" style={{ color: B.textFaint }}>
//                     {item.notes}
//                   </p>
//                 )}
//               </div>
//             </Card>
//           ))
//         )}
//       </div>

//       {showModal && (
//         <PinModal
//           item={editItem}
//           type={type}
//           onClose={() => setShowModal(false)}
//           onSave={(data) => {
//             if (editItem) {
//               setItems((prev) =>
//                 prev.map((i) => (i.id === editItem.id ? { ...i, ...data } : i)),
//               );
//               showToast("PIN config updated.");
//             } else {
//               setItems((prev) => [
//                 ...prev,
//                 { ...data, id: `pc${Date.now()}`, type } as PinConfig,
//               ]);
//               showToast("PIN config added.");
//             }
//             setShowModal(false);
//           }}
//         />
//       )}

//       {toast && <Toast msg={toast.msg} type={toast.type} />}
//     </div>
//   );
// }

// function PinModal({
//   item,
//   type,
//   onClose,
//   onSave,
// }: {
//   item: PinConfig | null;
//   type: "airtime" | "data";
//   onClose: () => void;
//   onSave: (data: Partial<PinConfig>) => void;
// }) {
//   const [form, setForm] = useState<Partial<PinConfig>>(
//     item ?? {
//       network: "mtn",
//       type,
//       label: "",
//       pin: "",
//       ussdCode: "",
//       isActive: true,
//       notes: "",
//     },
//   );
//   const [saving, setSaving] = useState(false);
//   const [showPin, setShowPin] = useState(false);

//   async function submit() {
//     setSaving(true);
//     await new Promise((r) => setTimeout(r, 600));
//     onSave(form);
//     setSaving(false);
//   }

//   return (
//     <div
//       className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
//       onClick={onClose}
//     >
//       <div
//         className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
//         style={{ border: `1px solid ${B.border}` }}
//         onClick={(e) => e.stopPropagation()}
//       >
//         <h2 className="mb-4 text-base font-bold" style={{ color: B.text }}>
//           {item ? `Edit ${type} PIN` : `Add ${type} PIN`}
//         </h2>

//         <div className="space-y-3">
//           <div>
//             <label
//               className="mb-1 block text-xs font-semibold"
//               style={{ color: B.textMuted }}
//             >
//               Network
//             </label>
//             <select
//               value={form.network}
//               onChange={(e) =>
//                 setForm((f) => ({ ...f, network: e.target.value as NetworkId }))
//               }
//               className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
//               style={{ borderColor: B.border, color: B.text }}
//             >
//               {NETWORKS.map((n) => (
//                 <option key={n.code} value={n.code}>
//                   {n.name}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <div>
//             <label
//               className="mb-1 block text-xs font-semibold"
//               style={{ color: B.textMuted }}
//             >
//               Label
//             </label>
//             <input
//               value={form.label ?? ""}
//               onChange={(e) =>
//                 setForm((f) => ({ ...f, label: e.target.value }))
//               }
//               placeholder={`e.g. MTN ${type === "airtime" ? "Airtime" : "Data"} Balance`}
//               className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
//               style={{ borderColor: B.border, color: B.text }}
//             />
//           </div>

//           <div>
//             <label
//               className="mb-1 block text-xs font-semibold"
//               style={{ color: B.textMuted }}
//             >
//               PIN / Code
//             </label>
//             <div className="relative">
//               <input
//                 type={showPin ? "text" : "password"}
//                 value={form.pin ?? ""}
//                 onChange={(e) =>
//                   setForm((f) => ({ ...f, pin: e.target.value }))
//                 }
//                 placeholder="e.g. *556#"
//                 className="w-full rounded-xl border py-2 pl-3 pr-9 font-mono text-sm outline-none"
//                 style={{ borderColor: B.border, color: B.text }}
//               />
//               <button
//                 type="button"
//                 onClick={() => setShowPin((s) => !s)}
//                 className="absolute right-3 top-1/2 -translate-y-1/2"
//                 style={{ color: B.textFaint }}
//               >
//                 {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
//               </button>
//             </div>
//           </div>

//           <div>
//             <label
//               className="mb-1 block text-xs font-semibold"
//               style={{ color: B.textMuted }}
//             >
//               USSD code
//             </label>
//             <input
//               value={form.ussdCode ?? ""}
//               onChange={(e) =>
//                 setForm((f) => ({ ...f, ussdCode: e.target.value }))
//               }
//               placeholder="e.g. *461*4#"
//               className="w-full rounded-xl border px-3 py-2 font-mono text-sm outline-none"
//               style={{ borderColor: B.border, color: B.text }}
//             />
//           </div>

//           <div>
//             <label
//               className="mb-1 block text-xs font-semibold"
//               style={{ color: B.textMuted }}
//             >
//               Notes
//             </label>
//             <textarea
//               value={form.notes ?? ""}
//               onChange={(e) =>
//                 setForm((f) => ({ ...f, notes: e.target.value }))
//               }
//               placeholder="Optional notes about this PIN…"
//               rows={2}
//               className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
//               style={{ borderColor: B.border, color: B.text }}
//             />
//           </div>
//         </div>

//         <div className="mt-5 flex gap-3">
//           <button
//             onClick={onClose}
//             className="flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold"
//             style={{ border: `1.5px solid ${B.border}`, color: B.text }}
//           >
//             Cancel
//           </button>
//           <button
//             onClick={submit}
//             disabled={saving || !form.label || !form.pin}
//             className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
//             style={{
//               background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
//             }}
//           >
//             {saving && <Loader2 size={14} className="animate-spin" />}
//             {saving ? "Saving…" : item ? "Save changes" : "Add PIN"}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ─── Tab configuration ────────────────────────────────────────────────────────

// const TABS: {
//   id: TabId;
//   label: string;
//   icon: React.ElementType;
//   description: string;
// }[] = [
//   {
//     id: "networks",
//     label: "Networks",
//     icon: Network,
//     description: "Manage MTN, Airtel, Glo, 9mobile network configs",
//   },
//   {
//     id: "airtime-types",
//     label: "Airtime types",
//     icon: Smartphone,
//     description: "VTU, SNS, SME, Share & Sell type configs",
//   },
//   {
//     id: "airtime-discounts",
//     label: "Airtime discounts",
//     icon: Percent,
//     description: "Per-network, per-type discount rates",
//   },
//   {
//     id: "data-plans",
//     label: "Data plans",
//     icon: Package,
//     description: "All data bundles with pricing and margins",
//   },
//   {
//     id: "airtime-pin",
//     label: "Airtime PINs",
//     icon: Key,
//     description: "Balance check PINs for airtime",
//   },
//   {
//     id: "data-pin",
//     label: "Data PINs",
//     icon: Shield,
//     description: "Balance check codes for data",
//   },
// ];

// // ─── Main page ────────────────────────────────────────────────────────────────

// export default function AirtimeDataPage() {
//   const [activeTab, setActiveTab] = useState<TabId>("networks");

//   const activeTabMeta = TABS.find((t) => t.id === activeTab)!;

//   return (
//     <div className="space-y-6">
//       {/* Page header */}
//       <div>
//         <h1 className="text-xl font-extrabold" style={{ color: B.text }}>
//           Airtime & Data
//         </h1>
//         <p className="mt-0.5 text-sm" style={{ color: B.textMuted }}>
//           Manage networks, types, plans, discounts, and balance check PINs.
//         </p>
//       </div>

//       {/* Tab nav — horizontal scroll on mobile */}
//       <div
//         className="flex gap-1 overflow-x-auto rounded-2xl p-1"
//         style={{ background: B.surface, border: `1px solid ${B.border}` }}
//       >
//         {TABS.map((tab) => {
//           const Icon = tab.icon;
//           const active = activeTab === tab.id;
//           return (
//             <button
//               key={tab.id}
//               onClick={() => setActiveTab(tab.id)}
//               className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all"
//               style={{
//                 background: active
//                   ? "linear-gradient(135deg, #F97316, #EA580C)"
//                   : "transparent",
//                 color: active ? "#fff" : B.textMuted,
//                 boxShadow: active ? "0 2px 10px rgba(249,115,22,0.2)" : "none",
//               }}
//             >
//               <Icon size={14} strokeWidth={2} />
//               <span className="hidden sm:inline">{tab.label}</span>
//             </button>
//           );
//         })}
//       </div>

//       {/* Active tab label */}
//       <div
//         className="flex items-center gap-3 rounded-2xl px-4 py-3"
//         style={{
//           background: B.orangeLight,
//           border: `1px solid rgba(249,115,22,0.15)`,
//         }}
//       >
//         <activeTabMeta.icon size={16} style={{ color: B.orange }} />
//         <div>
//           <p className="text-sm font-bold" style={{ color: B.orange }}>
//             {activeTabMeta.label}
//           </p>
//           <p className="text-xs" style={{ color: "#C2410C" }}>
//             {activeTabMeta.description}
//           </p>
//         </div>
//       </div>

//       {/* Tab content */}
//       {activeTab === "networks" && <NetworksTab />}
//       {activeTab === "airtime-types" && <AirtimeTypesTab />}
//       {activeTab === "airtime-discounts" && <AirtimeDiscountsTab />}
//       {/* {activeTab === "data-types" && <DataTypesTab />} */}
//       {activeTab === "data-plans" && <DataPlansTab />}
//       {activeTab === "airtime-pin" && <PinTab type="airtime" />}
//       {activeTab === "data-pin" && <PinTab type="data" />}
//     </div>
//   );
// }

// vtu-web/app/admin/services/airtime-data/page.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Smartphone,
  Wifi,
  Plus,
  RefreshCw,
  Loader2,
  Search,
  ToggleLeft,
  ToggleRight,
  Edit2,
  Trash2,
  X,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Tag,
  Percent,
  Database,
  Key,
  Network,
  Settings,
  Save,
  Copy,
  Eye,
  EyeOff,
  TrendingUp,
  Package,
  Shield,
  Zap,
} from "lucide-react";
import { CreateNetworkModal } from "@/components/admin/CreateNetworkModal";
import {
  AirtimeDiscount,
  deleteAirtimeDiscount,
  updateNetwork,
  updateNetworkType,
} from "@/lib/db/helpers";
import { getAllDataPlans, getDataPlans } from "@/lib/data/engine";
import { Toggle } from "@/components/ui/toggle";
import { NetworkTypeModal } from "@/components/admin/CreateNetworkTypeModal";
import { DataPlan } from "@/types";

// ─── Brand tokens (matching admin layout) ─────────────────────────────────────

const B = {
  orange: "#F97316",
  orangeDark: "#EA580C",
  orangeLight: "rgba(249,115,22,0.10)",
  green: "#22C55E",
  greenLight: "rgba(34,197,94,0.10)",
  red: "#EF4444",
  redLight: "rgba(239,68,68,0.10)",
  amber: "#F59E0B",
  amberLight: "rgba(245,158,11,0.10)",
  blue: "#3B82F6",
  blueLight: "rgba(59,130,246,0.10)",
  purple: "#8B5CF6",
  purpleLight: "rgba(139,92,246,0.10)",
  text: "#9ba6be",
  textMuted: "#6B7280",
  textFaint: "#9CA3AF",
  border: "#E5E7EB",
  surface: "#F9FAFB",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type NetworkId = "mtn" | "airtel" | "glo" | "9mobile";
type AirtimeType = "airtime" | "data" | "cable";
type DataCategory = "SME" | "Gifting" | "Corporate" | "Direct";
type TabId =
  | "networks"
  | "network-types"
  | "airtime-discounts"
  | "data-types"
  | "data-plans"
  | "airtime-pin"
  | "data-pin";

interface Network {
  id: string;
  code: NetworkId;
  name: string;
  color: string;
  logoLetter: string;
  isActive: boolean;
  airtimeEnabled: boolean;
  dataEnabled: boolean;
  shortcode: string;
}

interface AirtimeTypeConfig {
  id: string;
  type: AirtimeType;
  name: string;
  isActive: boolean;
}

interface DataType {
  id: string;
  network: NetworkId;
  category: DataCategory;
  label: string;
  isActive: boolean;
  description: string;
}

interface PinConfig {
  id: string;
  network: NetworkId;
  type: "airtime" | "data";
  label: string;
  pin: string;
  ussdCode: string;
  isActive: boolean;
  notes: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const NETWORKS: Network[] = [
  {
    id: "mtn",
    code: "mtn",
    name: "MTN",
    color: "#FFCC00",
    logoLetter: "M",
    isActive: true,
    airtimeEnabled: true,
    dataEnabled: true,
    shortcode: "*556#",
  },
  {
    id: "airtel",
    code: "airtel",
    name: "Airtel",
    color: "#E0001A",
    logoLetter: "A",
    isActive: true,
    airtimeEnabled: true,
    dataEnabled: true,
    shortcode: "*140#",
  },
  {
    id: "glo",
    code: "glo",
    name: "Glo",
    color: "#60B527",
    logoLetter: "G",
    isActive: true,
    airtimeEnabled: true,
    dataEnabled: true,
    shortcode: "*127*0#",
  },
  {
    id: "9mobile",
    code: "9mobile",
    name: "9mobile",
    color: "#008751",
    logoLetter: "9",
    isActive: false,
    airtimeEnabled: true,
    dataEnabled: false,
    shortcode: "*228#",
  },
];

const PIN_CONFIGS: PinConfig[] = [
  {
    id: "pc1",
    network: "mtn",
    type: "airtime",
    label: "MTN Airtime Balance",
    pin: "*556#",
    ussdCode: "*556#",
    isActive: true,
    notes: "Check airtime balance on MTN",
  },
  {
    id: "pc2",
    network: "mtn",
    type: "data",
    label: "MTN Data Balance",
    pin: "*461*4#",
    ussdCode: "*461*4#",
    isActive: true,
    notes: "Check data balance on MTN",
  },
  {
    id: "pc3",
    network: "airtel",
    type: "airtime",
    label: "Airtel Airtime Balance",
    pin: "*140#",
    ussdCode: "*140#",
    isActive: true,
    notes: "Check airtime balance on Airtel",
  },
  {
    id: "pc4",
    network: "airtel",
    type: "data",
    label: "Airtel Data Balance",
    pin: "*140#",
    ussdCode: "*140*1#",
    isActive: true,
    notes: "Check data balance on Airtel",
  },
  {
    id: "pc5",
    network: "glo",
    type: "airtime",
    label: "Glo Airtime Balance",
    pin: "*124*1#",
    ussdCode: "*124*1#",
    isActive: true,
    notes: "Check airtime balance on Glo",
  },
  {
    id: "pc6",
    network: "glo",
    type: "data",
    label: "Glo Data Balance",
    pin: "*127*0#",
    ussdCode: "*127*0#",
    isActive: false,
    notes: "Check data balance on Glo",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function marginPct(cost: number, sell: number) {
  if (!sell || !cost) return null;
  return (((sell - cost) / sell) * 100).toFixed(1);
}

const NETWORK_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All networks" },
  { value: "mtn", label: "MTN" },
  { value: "airtel", label: "Airtel" },
  { value: "glo", label: "Glo" },
  { value: "9mobile", label: "9mobile" },
];

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-white ${className}`}
      style={{ border: `1px solid ${B.border}` }}
    >
      {children}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-bold"
      style={{
        background: active ? B.greenLight : B.redLight,
        color: active ? B.green : B.red,
      }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function NetworkBadge({ code }: { code: NetworkId }) {
  const net = NETWORKS.find((n) => n.code === code);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold"
      style={{
        background: `${net?.color ?? "#ccc"}18`,
        color: net?.color ?? B.textFaint,
      }}
    >
      <span
        className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white"
        style={{ background: net?.color ?? "#ccc" }}
      >
        {net?.logoLetter}
      </span>
      {net?.name ?? code}
    </span>
  );
}

function Toast({
  msg,
  type = "success",
}: {
  msg: string;
  type?: "success" | "error" | "warn";
}) {
  const colors = {
    success: B.green,
    error: B.red,
    warn: B.amber,
  };
  return (
    <div
      className="fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-2xl"
      style={{ background: colors[type] }}
    >
      {type === "success" ? (
        <Check size={14} />
      ) : type === "warn" ? (
        <AlertTriangle size={14} />
      ) : (
        <X size={14} />
      )}
      {msg}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
  onAdd,
  addLink,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  onAdd?: () => void;
  addLink?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: B.orangeLight }}
      >
        <Icon size={26} style={{ color: B.orange }} />
      </div>
      <p className="text-sm font-semibold" style={{ color: B.text }}>
        {title}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs" style={{ color: B.textFaint }}>
          {subtitle}
        </p>
      )}
      {onAdd && !addLink && (
        <button
          onClick={onAdd}
          className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
          style={{
            background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
          }}
        >
          <Plus size={14} />
          Add first entry
        </button>
      )}
      {addLink && (
        <Link
          href={addLink}
          className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
          style={{
            background: `linear-gradient(135deg, ${B.orange}, ${B.orangeDark})`,
          }}
        >
          <Plus size={14} />
          Add first entry
        </Link>
      )}
    </div>
  );
}

// ─── Tab: Networks ────────────────────────────────────────────────────────────

function NetworksTab() {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Network>>({});
  const [saving, setSaving] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    async function fetchNetworks() {
      try {
        const response = await fetch("/api/v1/networks");
        const json = await response.json();

        if (response.ok) {
          setNetworks(json.data?.networks || json.networks || []);
        } else {
          showToast(json.message || "Failed to load networks", "error");
        }
      } catch (error) {
        showToast("Network error. Could not connect to API.", "error");
      } finally {
        setLoading(false);
      }
    }
    fetchNetworks();
  }, []);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

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

        showToast("Network updated.");
        setEditingId(null);
        setEditForm({});
      })
      .catch(() => showToast("Failed to save changes. Try again.", "error"))
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
        showToast(
          `${field === "isActive" ? "Network" : field === "airtimeEnabled" ? "Airtime" : "Data"} ${val ? "enabled" : "disabled"}.`,
        );
      })
      .catch(() => {
        setNetworks((prev) =>
          prev.map((n) => (n.code === id ? { ...n, [field]: !val } : n)),
        );
        showToast("Failed to update setting.", "error");
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
          <EmptyState title="No networks found" icon={Network} />
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
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      <CreateNetworkModal
        isOpen={isCreateModalOpen}
        id={networks?.length.toString()}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(newNetwork) => {
          setNetworks((prev) =>
            [...prev, newNetwork].sort((a, b) => a.name.localeCompare(b.name)),
          );
          showToast(`Successfully added ${newNetwork.name}!`);
        }}
      />
    </div>
  );
}

// ─── Tab: Network Types ───────────────────────────────────────────────────────

function NetworkTypesTab() {
  const [items, setItems] = useState<AirtimeTypeConfig[]>([]);
  const [networkFilter, setNetworkFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    (async function() {
      try {
        const res = await fetch(`/api/v1/networks/types`);
        const { data } = await res.json();
        if (data) setItems(data);
      } catch (error) {
        showToast("Failed to fetch network types", "error");
      } finally {
        setLoading(false);
      }
    })()
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
             setShowModal(true)
             setEditItem(null)
          }}
          // href="/admin/services/airtime-data/network-types/new"
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
            subtitle="Try adjusting filters or add a new network type."
            addLink="/admin/services/airtime-data/network-types/new"
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
                          setEditItem(item)
                        }}
                        // href={`/admin/services/airtime-data/network-types/${item.id}`}
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

      {toast && <Toast msg={toast.msg} type={toast.type} />}
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

// ─── Tab: Airtime Discounts ───────────────────────────────────────────────────

function AirtimeDiscountsTab() {
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
        // const nt = await getAllNetwork
        const { data } = await res.json();
        setItems(data);
      } catch {
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const filtered = items?.filter((i) =>
    networkFilter === "all" ? true : i.network === networkFilter,
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
            addLink="/admin/services/airtime-data/discounts/new"
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
                {filtered?.map((item) => {
                  return (
                    <tr
                      key={item.id}
                      className="group transition-colors hover:bg-gray-50"
                    >
                      <td
                        className="px-4 py-3 text-sm font-bold"
                        style={{ color: B.text }}
                      >
                        {item.network} | {item.type}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}

// ─── Tab: Data Plans ──────────────────────────────────────────────────────────

function DataPlansTab() {
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [networkFilter, setNetworkFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState("");
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
      const res = await fetch("/api/internal/data-plans");
      const _res = await res.json();
      const data = _res.data
      console.log(_res);


      setPlans(data);
    })();
  }, []);

  const filtered = plans?.filter((p) => {
    if (networkFilter !== "all" && p.network !== networkFilter) return false;
    if (catFilter !== "all" && p.type !== catFilter) return false;
    if (
      search &&
      !p.name.toLowerCase().includes(search.toLowerCase()) &&
      !p.size.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  function savePrice(id: string) {
    const kobo = Math.round(parseFloat(editingPrice) * 100);
    if (isNaN(kobo) || kobo <= 0) return;
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, sellPriceKobo: kobo } : p)),
    );
    setEditingPriceId(null);
    showToast("Price updated.");
  }

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
            value: plans?.filter((p) => p.costPriceKobo > p.sellPriceKobo)
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
            subtitle="Try adjusting filters or add a new plan?."
            addLink="/admin/services/airtime-data/data-plans/new"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                  {[
                    "Network|Data Type",
                    "Category",
                    "Plan",
                    "Size",
                    "Validity",
                    "Cost",
                    "Sell price",
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
                {filtered?.map((plan) => {
                  const margin = marginPct(
                    plan?.costPriceKobo,
                    plan?.sellPriceKobo,
                  );
                  const marginBreach =
                    plan?.costPriceKobo > plan?.sellPriceKobo;

                  return (
                    <tr
                      key={plan?.id}
                      className="group hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <NetworkBadge code={plan?.network} />|{plan?.type}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="rounded-md px-1.5 py-0.5 text-[11px] font-bold"
                          style={{ background: B.blueLight, color: B.blue }}
                        >
                          {plan?.category}
                        </span>
                      </td>
                      
                      <td
                        className="px-4 py-3 text-sm font-bold"
                        style={{ color: B.orange }}
                      >
                        {plan?.size}
                      </td>
                      <td
                        className="px-4 py-3 text-xs"
                        style={{ color: B.textMuted }}
                      >
                        {plan?.validity}
                      </td>
                      <td
                        className="px-4 py-3 text-sm"
                        style={{ color: B.textMuted }}
                      >
                        {plan?.costPriceKobo ? fmt(plan?.costPriceKobo) : "—"}
                      </td>
                      {/* Inline sell price editor */}
                      <td className="px-4 py-3">
                        {editingPriceId === plan?.id ? (
                          <div className="flex items-center gap-1">
                            <span
                              className="text-xs"
                              style={{ color: B.textFaint }}
                            >
                              ₦
                            </span>
                            <input
                              autoFocus
                              type="number"
                              value={editingPrice}
                              onChange={(e) => setEditingPrice(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") savePrice(plan?.id);
                                if (e.key === "Escape") setEditingPriceId(null);
                              }}
                              className="w-20 rounded-lg border px-1.5 py-1 text-sm font-bold outline-none"
                              style={{ borderColor: B.orange }}
                            />
                            <button
                              onClick={() => savePrice(plan?.id)}
                              className="flex h-6 w-6 items-center justify-center rounded-lg"
                              style={{ background: B.green, color: "#fff" }}
                            >
                              <Check size={11} />
                            </button>
                            <button
                              onClick={() => setEditingPriceId(null)}
                              className="flex h-6 w-6 items-center justify-center rounded-lg"
                              style={{ background: B.redLight, color: B.red }}
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="text-sm font-bold"
                              style={{ color: B.text }}
                            >
                              {fmt(plan?.sellPriceKobo)}
                            </span>
                            <button
                              onClick={() => {
                                setEditingPriceId(plan?.id);
                                setEditingPrice(
                                  String(plan?.sellPriceKobo / 100),
                                );
                              }}
                              className="rounded-md p-1 opacity-0 transition hover:bg-gray-100 group-hover:opacity-100"
                              style={{ color: B.textFaint }}
                            >
                              <Edit2 size={11} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {margin !== null ? (
                          <span
                            className="rounded-lg px-2 py-0.5 text-xs font-bold"
                            style={{
                              background: marginBreach
                                ? B.redLight
                                : B.greenLight,
                              color: marginBreach ? B.red : B.green,
                            }}
                          >
                            {marginBreach ? "−" : "+"}
                            {Math.abs(Number(margin))}%
                          </span>
                        ) : (
                          <span
                            className="text-xs italic"
                            style={{ color: B.textFaint }}
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge active={plan?.isActive} />
                          <Toggle
                            checked={plan?.isActive}
                            onChange={(v) => {
                              setPlans((prev) =>
                                prev.map((p) =>
                                  p.id === plan?.id ? { ...p, isActive: v } : p,
                                ),
                              );
                              showToast(`Plan ${v ? "enabled" : "disabled"}.`);
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}

// ─── Tab: PIN Configs ─────────────────────────────────────────────────────────

function PinTab({ type }: { type: "airtime" | "data" }) {
  const [items, setItems] = useState<PinConfig[]>(
    PIN_CONFIGS.filter((p) => p.type === type),
  );
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
            addLink={`/admin/services/airtime-data/pins/new?type=${type}`}
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
                      <NetworkBadge code={item.network} />
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

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}

// ─── Tab configuration ────────────────────────────────────────────────────────

const TABS: {
  id: TabId;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    id: "networks",
    label: "Networks",
    icon: Network,
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AirtimeDataPage() {
  const [activeTab, setActiveTab] = useState<TabId>("networks");

  const activeTabMeta = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-extrabold" style={{ color: B.text }}>
          Airtime & Data
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: B.textMuted }}>
          Manage networks, types, plans, discounts, and balance check PINs.
        </p>
      </div>

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
      {activeTab === "networks" && <NetworksTab />}
      {activeTab === "network-types" && <NetworkTypesTab />}
      {activeTab === "airtime-discounts" && <AirtimeDiscountsTab />}
      {/* {activeTab === "data-types" && <DataTypesTab />} */}
      {activeTab === "data-plans" && <DataPlansTab />}
      {activeTab === "airtime-pin" && <PinTab type="airtime" />}
      {activeTab === "data-pin" && <PinTab type="data" />}
    </div>
  );
}
