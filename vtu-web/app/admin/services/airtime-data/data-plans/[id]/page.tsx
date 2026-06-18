import CreateDiscount from "@/components/admin/CreateDiscount";
import PlanForm from "@/components/admin/PlanForm";
import {
  getActiveProviders,
  getAllNetworks,
  getAllNetworkTypes,
  getDataPlan,
} from "@/lib/db/helpers";
import { listRoles } from "@/lib/roles/service";
import { serializeData } from "@/lib/utils";

export default async function CreateDiscountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const networks = await getAllNetworks().then((n) =>
    n.filter((n) => n.type == "telecom"),
  );
  const networkTypes = await getAllNetworkTypes().then((nt) =>
    nt.filter((n) => n.type == "data"),
  );

  const providers = await getActiveProviders();
  const roles = await listRoles();
  const dp = await getDataPlan(id);

  return (
    <PlanForm
      networks={serializeData(networks)}
      networkTypes={serializeData(networkTypes)}
      providers={serializeData(providers)}
      roles={serializeData(roles)}
      plan={serializeData(dp)}
    />
  );
}
