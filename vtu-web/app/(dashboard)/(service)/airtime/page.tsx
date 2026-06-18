import { AirtimeFormContent } from "@/components/services/airtime";
import { getAllNetworks } from "@/lib/db/helpers";
import { serializeData } from "@/lib/utils";

export default async function AirtimePage() {
  const nets = (await getAllNetworks()).filter((nt) => nt.type === "telecom");
  return <AirtimeFormContent networks={serializeData(nets)} />;
}
