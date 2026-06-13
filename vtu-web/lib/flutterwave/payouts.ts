// vtu-web/lib/flutterwave/payouts.ts
// AGENTS.md RULES: #3 (payments), #9 (log every external call), #11 (test with emulator)

// IMPORTS NEEDED:
// - FlutterwaveClient from @/lib/flutterwave/client
// - env from @/lib/utils/env
// - logExternalCall from @/lib/utils/logger
// - PayoutRequest, PayoutResponse types from @/types
// - adminDb from @/lib/firebase/admin
import * as FlutterwaveClient from "./client"
import { env } from "../utils/env";
import { logExternalCall } from "../utils/logger";
import { PayoutResponse } from "@/types";



interface IRecipientData {
    name:string
    accountNumber:string;
    bankCode:string|number
    currency:string
}
// ─── PAYOUTS ───────────────────────────────────────────────────────────────────

// FUNCTION: createPayoutRecipient(recipientData)
// PURPOSE : Register a payout beneficiary with Flutterwave.
// PARAMS  : recipientData: { name, accountNumber, bankCode, currency }
// RETURNS : Promise<PayoutRecipient>
//
// STEPS:
//   1. Build recipient payload.
//   2. Call FlutterwaveClient.post('/v3/payout-batch/beneficiaries', payload).
//   3. Map provider response to internal recipient shape.
//   4. Return beneficiary record.

export async function createPayoutRecipient(recipientData:IRecipientData):Promise<PayoutResponse>{
    const payload = {
        name: recipientData.name,
        account_number: recipientData.accountNumber,
        bank_code: recipientData.bankCode,
        currency: recipientData.currency,
    }

    try {
        const response = await FlutterwaveClient.post('/v3/payout-batch/beneficiaries', JSON.stringify(payload));
        if (response.status === 'success' && response.data) {
            const beneficiary = response.data as any;
            return {
                status: 'success',
                data: {
                    recipientId: beneficiary.id,
                    name: beneficiary.name,
                    accountNumber: beneficiary.account_number,
                    bankCode: beneficiary.bank_code,
                },
                message: 'Payout recipient created successfully',
            }
        }
        throw new Error(`Failed to create payout recipient: ${response.message}`);
    } catch (error) {
        const e = error as unknown as Error
        throw new Error(`Error creating payout recipient: ${e.message}`);
    }
}

// FUNCTION: initiatePayout(amount, currency, recipientId, metadata)
// PURPOSE : Send a payout request through Flutterwave.
// PARAMS  :
//   - amount: number — kobo-converted amount or provider currency minor unit.
//   - currency: string
//   - recipientId: string
//   - metadata: Record<string, any>
// RETURNS : Promise<PayoutResponse>
// THROWS  : Error if Flutterwave rejects the payout.
//
// STEPS:
//   1. Build payout batch payload.
//   2. Call FlutterwaveClient.post('/v3/payout-batches', payload).
//   3. Log request and response.
//   4. Persist payout request status if needed.
//   5. Return response.

// export function

// FUNCTION: getPayoutStatus(payoutId)
// PURPOSE : Fetch payout status from Flutterwave.
// PARAMS  : payoutId: string
// RETURNS : Promise<PayoutStatus>
//
// STEPS:
//   1. Call FlutterwaveClient.get(`/v3/payout-batches/${payoutId}`).
//   2. Normalize and return status.
