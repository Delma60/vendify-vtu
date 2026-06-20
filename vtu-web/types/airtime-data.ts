// vtu-web/components/admin/airtime-data/types.ts

export type NetworkId = "mtn" | "airtel" | "glo" | "9mobile";
export type AirtimeType = "airtime" | "data" | "cable";
export type DataCategory = "SME" | "Gifting" | "Corporate" | "Direct";

export type TabId =
  | "networks"
  | "network-types"
  | "airtime-discounts"
  | "data-types"
  | "data-plans"
  | "airtime-pin"
  | "data-pin";

export interface Network {
  id: string;
  code: NetworkId;
  name: string;
  color: string;
  logoLetter: string;
  isActive: boolean;
  airtimeEnabled: boolean;
  dataEnabled: boolean;
  shortcode: string;
}

export interface AirtimeTypeConfig {
  id: string;
  type: AirtimeType;
  name: string;
  isActive: boolean;
}

export interface DataType {
  id: string;
  network: NetworkId;
  category: DataCategory;
  label: string;
  isActive: boolean;
  description: string;
}

export interface PinConfig {
  id: string;
  network: NetworkId;
  type: "airtime" | "data";
  label: string;
  pin: string;
  ussdCode: string;
  isActive: boolean;
  notes: string;
}