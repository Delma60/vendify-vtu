// vtu-web/lib/providers/interface.ts
// AGENTS.md RULES: #3 (payments), #13 (config from Firestore)

import type {
  AirtimeParams,
  CableParams,
  DataParams,
  ElectricityParams,
  ExamPinParams,
  MeterInfo,
  ProviderConfig,
  ProviderResponse,
  ServiceType,
  SmartCardInfo,
  WebhookResult,
} from '@/types/provider';

/**
 * Every concrete provider (VTPass, SME Plug, Bilal, Ogdams, ...) must
 * implement this interface. ProviderFactory.make() returns this type.
 */
export interface VTUProviderInterface {
  readonly code: string;
  readonly config: ProviderConfig;

  buyAirtime(params: AirtimeParams): Promise<ProviderResponse>;
  buyData(params: DataParams): Promise<ProviderResponse>;
  payElectricity(params: ElectricityParams): Promise<ProviderResponse>;
  payCable(params: CableParams): Promise<ProviderResponse>;
  buyExamPin(params: ExamPinParams): Promise<ProviderResponse>;

  verifyMeter(meterNumber: string, disco: string, type: 'prepaid' | 'postpaid'): Promise<MeterInfo>;
  verifySmartCard(cardNumber: string, cableNetwork: string): Promise<SmartCardInfo>;

  getBalance(): Promise<number>;
  checkTransactionStatus(reference: string): Promise<ProviderResponse>;

  supportsService(service: ServiceType): boolean;
  isHealthy(): Promise<boolean>;

  /** Normalise an inbound webhook/callback payload from this provider */
  handleWebhook(payload: Record<string, unknown>): Promise<WebhookResult>;
}