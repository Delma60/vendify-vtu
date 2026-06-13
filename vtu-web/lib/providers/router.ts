// vtu-web/lib/providers/router.ts
// AGENTS.md RULES: #3 (payments), #9 (log every external call), #14 (runtime config)

// IMPORTS NEEDED:
// - adminDb from @/lib/firebase/admin
// - getProviderConfig from @/lib/utils/config
// - BilalProvider from @/lib/providers/bilal
// - SimhostNGProvider from @/lib/providers/simhostng
// - OgdamsProvider from @/lib/providers/ogdams
// - logExternalCall from @/lib/utils/logger
// - ProviderResponse from @/types

// ─── PROVIDER ROUTER ───────────────────────────────────────────────────────────

// FUNCTION: selectProvider(service, userId)
// PURPOSE : Choose primary and fallback providers for a service.
// PARAMS  : service: string, userId: string
// RETURNS : { primary: VTUProvider, fallback: VTUProvider | null }
//
// STEPS:
//   1. Load service provider config from Firestore.
//   2. Check provider float and active status.
//   3. Prefer primary provider, fallback if primary is unavailable.
//   4. Return selected provider instances.

// FUNCTION: executeWithFailover(operationName, params)
// PURPOSE : Run provider operation with failover support.
// PARAMS  : operationName: string, params: any
// RETURNS : Promise<ProviderResponse>
//
// STEPS:
//   1. Call primary provider operation.
//   2. If primary fails or times out, log error and try fallback.
//   3. If fallback succeeds, return its response.
//   4. If both fail, write to dead_letter_queue and return failure.

// FUNCTION: buyAirtime(params)
// PURPOSE : Route airtime purchase through provider router.
// RETURNS : Promise<ProviderResponse>

// FUNCTION: buyData(params)
// PURPOSE : Route data purchase through provider router.
// RETURNS : Promise<ProviderResponse>

// FUNCTION: payElectricity(params)
// PURPOSE : Route electricity payment through provider router.
// RETURNS : Promise<ProviderResponse>

// FUNCTION: payCable(params)
// PURPOSE : Route cable payment through provider router.
// RETURNS : Promise<ProviderResponse>

// FUNCTION: buyExamPin(params)
// PURPOSE : Route exam pin purchase through provider router.
// RETURNS : Promise<ProviderResponse>

// FUNCTION: getDataPlans(network)
// PURPOSE : Route data plan fetch through provider router.
// RETURNS : Promise<DataPlan[]>

// FUNCTION: verifyMeter(meterNumber, disco, type)
// PURPOSE : Route meter verification through provider router.
// RETURNS : Promise<MeterInfo>

// FUNCTION: verifySmartCard(number, provider)
// PURPOSE : Route smartcard verification through provider router.
// RETURNS : Promise<SmartCardInfo>

// FUNCTION: checkTransactionStatus(reference)
// PURPOSE : Check provider status for a reference.
// RETURNS : Promise<ProviderResponse>
