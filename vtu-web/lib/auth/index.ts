import { adminDb } from "../firebase/admin";
import { getSession } from "./session";


export async function auth(){
    const session = await getSession();
    if(!session) return null;
        const userSnap = await adminDb.collection('users').doc(session?.uid).get()
        return userSnap.exists ? userSnap.data() : null;
}