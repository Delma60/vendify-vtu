import { getAllAirtimeDiscounts } from "@/lib/db/helpers";
import { err, ok } from "@/lib/utils/response";
import { NextRequest } from "next/server";


export async function GET(request:NextRequest){
    try {
        const discounts = getAllAirtimeDiscounts();
        console.log(discount)
        return ok(discounts ?? [])
    } catch (error) {
        return err('An error occurred while fetching airtime discounts.', 500);
    }
}