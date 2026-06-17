import CreateDiscount from "@/components/admin/CreateDiscount";
import {
  getActiveProviders,
  getAllNetworks,
  getAllNetworkTypes,
} from "@/lib/db/helpers";
import { listRoles } from "@/lib/roles/service";

export default async function CreateDiscountPage() {
  const networks = await getAllNetworks();
  const networkTypes = await getAllNetworkTypes().then((nt) =>
    nt.filter((n) => n.type == "airtime"),
  );

  const providers = await getActiveProviders();
  const roles = await listRoles()
  // console.log({
  //   networks,
  //   networkTypes,
  //   providers,
  //   roles
  // })

  return <CreateDiscount 
    networks={networks} 
    networkTypes={networkTypes} 
    providers={providers}
    roles={roles}
  />;
}
