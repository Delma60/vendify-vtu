import { getAllAirtimeDiscounts, getNetwork } from "@/lib/db/helpers";
import { Network } from "@/types"
import { err, ok } from "@/lib/utils/response";
import { NextRequest } from "next/server";


export async function GET(request:NextRequest){
    // let discounts;
    try {
       let discounts = await getAllAirtimeDiscounts();
        discounts = await Promise.all(
            discounts.map(async (dp: any) => {
            // Handle database inconsistency (some docs use 'plan', some use 'planType')
                const planId = dp.network_id;
                console.log(typeof planId)
                const nt = (await getNetwork(planId.toString())) as Network;
                dp.network = nt; 
                
                return dp;
            })
        );

        console.log({discounts})
        return ok(discounts ?? [])
    } catch (error) {
        console.log(error)
        return err('An error occurred while fetching airtime discounts.', 500);
    }
}