// vtu-web/app/admin/services/airtime-data/page.tsx
import { AirtimeDataTabs } from "@/components/admin/airtime-data/AirtimeDataTabs";
import { getAllDataPlans } from "@/lib/data/engine";
import { getAllNetworks, getAllNetworkTypes } from "@/lib/db/helpers";
import { B, serializeData } from "@/lib/utils";

// No "use client" here — this page is a Server Component. It fetches the
// Networks, Network types, and Data plans tabs' data up front (via the same
// `lib/db/helpers` / `lib/data/engine` helpers the sibling create/edit pages
// already use) so those tabs render with real data on first paint instead of
// flashing a client-side loading spinner.
//
// Airtime discounts and the PIN configs tab are intentionally left as-is
// (client-fetched / mocked) — see the NOTE at the top of
// AirtimeDiscountsTab.tsx for why.
export default async function AirtimeDataPage() {
  const [networks, networkTypes, dataPlans] = await Promise.all([
    getAllNetworks(),
    getAllNetworkTypes(),
    getAllDataPlans(),
  ]);

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

      <AirtimeDataTabs
        initialNetworks={serializeData(networks)}
        initialNetworkTypes={serializeData(networkTypes)}
        initialDataPlans={serializeData(dataPlans)}
      />
    </div>
  );
}