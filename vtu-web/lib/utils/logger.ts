import { adminDb } from "../firebase/admin";

export function logExternalCall(service: string, endpoint: string, requestData: any, responseData: any, success: boolean) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        service,
        endpoint,
        requestData,
        responseData,
        success,
    };
    // firebase 
    adminDb.collection('externalApiLogs').add(logEntry).catch((err) => {
        console.error('Failed to log external API call:', err);
    })
}