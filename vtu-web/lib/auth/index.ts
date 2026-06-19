import { adminDb } from "../firebase/admin";
import { getRole } from "../roles/service";
import { getSession } from "./session";


export async function auth(){
    const session = await getSession();
    if(!session) return null;
    const userSnap = await adminDb.collection('users').doc(session?.uid).get()
    
    const user = userSnap.exists ? userSnap.data() : null;
    if(user){
         user['role'] = await getRole(user?.roleId)
    }
    return user
}