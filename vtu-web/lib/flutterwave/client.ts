// vtu-web/lib/flutterwave/client.ts
// AGENTS.md RULES: #3 (payments), #4 (zod), #9 (log every external call)
import fetch, { BodyInit } from 'node-fetch';
import { createHmac } from 'crypto';
import { env } from '../utils/env';
import { adminDb } from '@/lib/firebase/admin';
// import { logExternalCall } from '@/lib/utils/logger';
import { FlutterwaveResponse, FlutterwaveWebhookEvent } from '@/types';
import { logExternalCall } from '../utils/logger';
// IMPORTS NEEDED:
// - fetch from node-fetch
// - env from @/lib/utils/env
// - createHmac from crypto
// - adminDb from @/lib/firebase/admin
// - logExternalCall from @/lib/utils/logger
// - FlutterwaveResponse types from @/types



// ─── FLUTTERWAVE CLIENT ───────────────────────────────────────────────────────

// FUNCTION: getHeaders()
// PURPOSE : Build Flutterwave API headers with secret key and content type.
// RETURNS : Record<string,string>

//
// STEPS:
//   1. Read FLUTTERWAVE_SECRET_KEY and FLUTTERWAVE_PUBLIC_KEY from env.
//   2. Return Authorization and Content-Type headers.

export function getHeaders():Record<string, string> {
    const secretKey = env('FLUTTERWAVE_SECRET_KEY');
    const publicKey = env('FLUTTERWAVE_PUBLIC_KEY');
    if (!secretKey || !publicKey) {
        throw new Error('Flutterwave API keys are not configured in environment variables.');
    }
    return {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
    };
}

// FUNCTION: post(url, body)
// PURPOSE : Send POST request to Flutterwave and parse JSON response.
// RETURNS : Promise<FlutterwaveResponse>
// THROWS  : Error if network fails or response indicates failure.
//
// STEPS:
//   1. Build request headers.
//   2. Send POST request using fetch.
//   3. Log request/response with logExternalCall.
//   4. Return parsed response.

export async function post(url:string, body:BodyInit| null =null):Promise<FlutterwaveResponse>{
    const headers = getHeaders();
    const request = {
            method: 'POST',
            headers,
            body,
        }
        try {
            
            const resposnes = await fetch(buildUrl(url) , {
                method: "POST",
                body,
                headers
            });
            const responseBody = await resposnes.text();
            logExternalCall('Flutterwave API', url, request, responseBody, resposnes.ok)
            return {
                status: resposnes.ok ? 'success' : 'error',
                data: resposnes.ok ? JSON.parse(responseBody) : null,
                message: resposnes.ok ? 'Request successful' : `Request failed with status ${resposnes.status}`,
            }
        } catch (error) {
            logExternalCall('Flutterwave API', url, request, 'Error occurred while fetching Flutterwave API', false);
            throw error;
        }
}
// FUNCTION: get(url)
// PURPOSE : Send GET request to Flutterwave.
// RETURNS : Promise<FlutterwaveResponse>
//
// STEPS:
//   1. Build request headers.
//   2. Send GET request using fetch.
//   3. Log request/response with logExternalCall.
//   4. Return parsed response.

export async function get(url:string):Promise<FlutterwaveResponse>{
    const headers = getHeaders();
    const request = {
            method: 'GET',
            headers,
    }
    try {
        const res = await fetch(buildUrl(url) , request)
        const responseBody = await res.text();
        logExternalCall('Flutterwave API', url, request, responseBody, res.ok)
        return {
            data: res.ok ? JSON.parse(responseBody) : null,
            status: res.ok ? 'success' : 'error',
            message: res.ok ? 'Request successful' : `Request failed with status ${res.status}`,
        }
    } catch (error) {
        logExternalCall('Flutterwave API', url, request, 'Error occurred while fetching Flutterwave API', false);
        throw error;
    }


}

// FUNCTION: verifyWebhookSignature(rawBody, signature)
// PURPOSE : Validate Flutterwave webhook signature with secret key.
// PARAMS  : rawBody: string, signature: string
// RETURNS : boolean
//
// STEPS:
//   1. Create HMAC SHA-256 of rawBody using FLUTTERWAVE_SECRET_KEY.
//   2. Compare with signature header.
//   3. Return true if matches.

export async function verifyWebhookSignature(rawBody:unknown, signature:string):Promise<boolean>{
    const secretKey = env('FLUTTERWAVE_SECRET_KEY') as string;
    const computedSignature = createHmac('sha256', secretKey).update(JSON.stringify(rawBody)).digest('hex');
    return computedSignature === signature;
}

// FUNCTION: buildWebhookEvent(body)
// PURPOSE : Normalize webhook payload for internal processing.
// RETURNS : Promise<FlutterwaveWebhookEvent>
//
// STEPS:
//   1. Extract event type, data, status, and reference.
//   2. Map provider fields to internal shape.
//   3. Return normalized event object.
export async function buildWebhookEvent(body:any):Promise<FlutterwaveWebhookEvent>{
    const event:FlutterwaveWebhookEvent = {
        eventType: body.event || 'unknown_event',
        eventData: body.data || {},
        eventStatus: body.data?.status || 'unknown_status',
        eventTime: body.data?.event_time || 'unknown_time',
        eventReference: body.data?.tx_ref || 'unknown_reference',
    }
    return event;
    
}

// build url

function buildUrl(endpoint:string):string{
    const baseUrl = env("FLUTTERWAVE_BASEURL");
    if(!baseUrl){
        throw new Error('Flutterwave base URL is not configured in environment variables.');
    }

    return `${baseUrl}${endpoint}`;
}