import { getAllDataPlans } from "@/lib/data/engine";
import { err, ok } from "@/lib/utils/response";


export async function GET(){
    try{
        const dps = await getAllDataPlans();
        console.log({dps})
        return ok(dps)
    }

    catch(e){
        console.log(e)
        return err("Something went wrong")
    }
}