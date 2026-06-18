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


export const B = {
  orange: "#F97316",
  orangeDark: "#EA580C",
  orangeLight: "rgba(249,115,22,0.10)",
  green: "#22C55E",
  greenLight: "rgba(34,197,94,0.10)",
  red: "#EF4444",
  redLight: "rgba(239,68,68,0.10)",
  amber: "#F59E0B",
  amberLight: "rgba(245,158,11,0.10)",
  blue: "#3B82F6",
  blueLight: "rgba(59,130,246,0.10)",
  purple: "#8B5CF6",
  purpleLight: "rgba(139,92,246,0.10)",
  text: "#111827",
  textMuted: "#6B7280",
  textFaint: "#9CA3AF",
  border: "#E5E7EB",
  surface: "#F9FAFB",
};
