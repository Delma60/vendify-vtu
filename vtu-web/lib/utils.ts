import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function serializeData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  // If it's a Firestore Timestamp object, convert it to an ISO string
  if (typeof obj.toDate === 'function') return obj.toDate().toISOString();
  
  // Recursively process arrays
  if (Array.isArray(obj)) return obj.map(serializeData);
  
  // Recursively process nested objects
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = serializeData(obj[key]);
    }
    return result;
  }
  
  return obj;
}
