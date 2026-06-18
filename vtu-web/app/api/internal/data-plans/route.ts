import { getAllDataPlans } from "@/lib/data/engine";
import { getNetworkType } from "@/lib/db/helpers";
import { err, ok } from "@/lib/utils/response";
import { NetworkType } from "@/types";

export async function GET() {
  try {
    let dps = await getAllDataPlans();
    
    // Use Promise.all to wait for all async map iterations to finish
    dps = await Promise.all(
      dps.map(async (dp: any) => {
        // Handle database inconsistency (some docs use 'plan', some use 'planType')
        const planId = dp.planType || dp.plan;

        if (planId && typeof planId === "string") {
          const nt = (await getNetworkType(planId)) as NetworkType;
          
          // Attach the resolved network type to the data plan object
          // so the frontend can access it (e.g., dp.networkTypeDetails.name)
          dp.planType = nt; 
        }

        
        return dp;
    })
);
console.log({ dps })

    return ok(dps);
  } catch (e) {
    console.error(e);
    return err("Something went wrong");
  }
}