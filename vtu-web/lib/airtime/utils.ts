// vtu-web/lib/airtime/utils.ts

export const NIGERIAN_NETWORKS = ['mtn', 'airtel', 'glo', '9mobile'] as const;
export const INTERNATIONAL_NETWORKS = ['mtn', 'airtel', 'glo', '9mobile', 'safaricom', 'vodacom', 'orange', 'mtn-gh', 'mtn-cm', 'mtn-rw'] as const;

export type NigerianNetwork = typeof NIGERIAN_NETWORKS[number];
export type AirtimeNetwork = typeof NIGERIAN_NETWORKS[number] | typeof INTERNATIONAL_NETWORKS[number];

export const NETWORK_PREFIXES: Record<string, NigerianNetwork> = {
  '0803': 'mtn', '0806': 'mtn', '0703': 'mtn', '0706': 'mtn', '0813': 'mtn',
  '0816': 'mtn', '0810': 'mtn', '0814': 'mtn', '0903': 'mtn', '0906': 'mtn',
  '0913': 'mtn', '0916': 'mtn',
  '0802': 'airtel', '0808': 'airtel', '0812': 'airtel', '0701': 'airtel',
  '0708': 'airtel', '0902': 'airtel', '0901': 'airtel', '0904': 'airtel',
  '0907': 'airtel', '0912': 'airtel',
  '0805': 'glo', '0807': 'glo', '0815': 'glo', '0811': 'glo', '0905': 'glo',
  '0915': 'glo',
  '0809': '9mobile', '0818': '9mobile', '0817': '9mobile', '0909': '9mobile',
  '0908': '9mobile',
};

export function detectNetwork(phone: string): NigerianNetwork | null {
  const normalised = phone.replace(/^\+234/, '0').replace(/\s/g, '');
  const prefix = normalised.slice(0, 4);
  return NETWORK_PREFIXES[prefix] ?? null;
}

export function normalisePhone(phone: string): string {
  const stripped = phone.replace(/\s/g, '');
  if (stripped.startsWith('+')) return stripped;
  if (stripped.startsWith('234')) return `+${stripped}`;
  if (stripped.startsWith('0')) return `+234${stripped.slice(1)}`;
  return `+234${stripped}`;
}