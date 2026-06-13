/**
 * Device/session tracking
 *
 * - Generates a stable device ID from User-Agent + IP (hashed)
 * - Stores known devices per user in Firestore users/{uid}/devices/{deviceId}
 * - Returns isNewDevice: true when a device is seen for the first time
 */

import { createHash, randomBytes } from 'crypto';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { DeviceInfo } from '@/types';

// ─── Fingerprint ──────────────────────────────────────────────────────────────

/**
 * Deterministic device ID derived from IP + User-Agent.
 * Not cryptographically identifying users — purely for "new device" detection.
 */
export function buildDeviceId(ip: string, userAgent: string): string {
  return createHash('sha256')
    .update(`${ip}|${userAgent}`)
    .digest('hex')
    .slice(0, 32);
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

export async function getKnownDevice(
  uid: string,
  deviceId: string
): Promise<DeviceInfo | null> {
  const snap = await adminDb
    .collection('users')
    .doc(uid)
    .collection('devices')
    .doc(deviceId)
    .get();

  return snap.exists ? (snap.data() as DeviceInfo) : null;
}

/**
 * Upsert a device record. Returns true if this is the first time we've seen it.
 */
export async function upsertDevice(
  uid: string,
  ip: string,
  userAgent: string
): Promise<{ deviceId: string; isNewDevice: boolean }> {
  const deviceId = buildDeviceId(ip, userAgent);
  const ref = adminDb
    .collection('users')
    .doc(uid)
    .collection('devices')
    .doc(deviceId);

  const snap = await ref.get();
  const isNewDevice = !snap.exists;

  await ref.set(
    {
      id: deviceId,
      userAgent,
      ip,
      lastSeenAt: FieldValue.serverTimestamp(),
      ...(isNewDevice ? { createdAt: FieldValue.serverTimestamp() } : {}),
    },
    { merge: true }
  );

  return { deviceId, isNewDevice };
}

/** Generate a unique session ID for the token payload */
export function generateSessionId(): string {
  return randomBytes(16).toString('hex');
}

/** Store active session reference in Firestore for future invalidation */
export async function storeSession(
  uid: string,
  sessionId: string,
  deviceId: string,
  expiresAt: Date
): Promise<void> {
  await adminDb
    .collection('users')
    .doc(uid)
    .collection('sessions')
    .doc(sessionId)
    .set({
      sessionId,
      deviceId,
      isRevoked: false,
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
    });
}

/** Revoke a specific session (logout) */
export async function revokeSession(uid: string, sessionId: string): Promise<void> {
  await adminDb
    .collection('users')
    .doc(uid)
    .collection('sessions')
    .doc(sessionId)
    .update({ isRevoked: true });
}

/** Check if a session has been revoked (e.g. remote logout) */
export async function isSessionRevoked(uid: string, sessionId: string): Promise<boolean> {
  const snap = await adminDb
    .collection('users')
    .doc(uid)
    .collection('sessions')
    .doc(sessionId)
    .get();

  if (!snap.exists) return true;
  return snap.data()?.isRevoked === true;
}

/** Revoke all sessions for a user (admin suspend / password change) */
export async function revokeAllSessions(uid: string): Promise<void> {
  const sessions = await adminDb
    .collection('users')
    .doc(uid)
    .collection('sessions')
    .where('isRevoked', '==', false)
    .get();

  const batch = adminDb.batch();
  sessions.docs.forEach((doc) => batch.update(doc.ref, { isRevoked: true }));
  await batch.commit();
}