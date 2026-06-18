import CreateDiscount from "@/components/admin/CreateDiscount";
import {
  getActiveProviders,
  getAllNetworks,
  getAllNetworkTypes,
} from "@/lib/db/helpers";
import { listRoles } from "@/lib/roles/service";
import { serializeData } from "@/lib/utils";

export default async function CreateDiscountPage() {
  const networks = await getAllNetworks().then((n) =>
    n.filter((n) => n.type == "telecom"),
  );
  const networkTypes = await getAllNetworkTypes().then((nt) =>
    nt.filter((n) => n.type == "data"),
  );

  const providers = await getActiveProviders();
  const roles = await listRoles();

  return (
    <CreateDiscount
      networks={serializeData(networks)}
      networkTypes={serializeData(networkTypes)}
      providers={serializeData(providers)}
      roles={serializeData(roles)}
      
    />
  );
}
