// vtu-web/lib/providers/interface.ts
// AGENTS.md RULES: #3 (payments), #4 (zod), #14 (runtime config)

// IMPORTS NEEDED:
// - ProviderResponse types from @/types
// - DataPlan, MeterInfo, SmartCardInfo types from @/types

// ─── PROVIDER INTERFACES ───────────────────────────────────────────────────────

// INTERFACE: VTUProvider
// PURPOSE : Abstract provider operations for airtime, data, cable, electricity, and more.
//
// PROPERTIES:
//   - name: string
//   - supportsPricePullAPI: boolean
//
// METHODS:
//   - buyAirtime(params: AirtimeParams): Promise<ProviderResponse>
//   - buyData(params: DataParams): Promise<ProviderResponse>
//   - payElectricity(params: ElectricityParams): Promise<ProviderResponse>
//   - payCable(params: CableParams): Promise<ProviderResponse>
//   - buyExamPin(params: ExamPinParams): Promise<ProviderResponse>
//   - getDataPlans(network: string): Promise<DataPlan[]>
//   - verifyMeter(meterNumber: string, disco: string, type: string): Promise<MeterInfo>
//   - verifySmartCard(number: string, provider: string): Promise<SmartCardInfo>
//   - getBalance(): Promise<number>
//   - checkTransactionStatus(reference: string): Promise<ProviderResponse>

// TYPE: AirtimeParams
// TYPE: DataParams
// TYPE: ElectricityParams
// TYPE: CableParams
// TYPE: ExamPinParams
// TYPE: ProviderResponse
// TYPE: DataPlan
// TYPE: MeterInfo
// TYPE: SmartCardInfo
