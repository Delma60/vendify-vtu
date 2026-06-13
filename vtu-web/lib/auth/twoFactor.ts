/**
 * Two-Factor Authentication
 *
 * Supports two methods:
 *  1. email_otp  — 6-digit OTP sent to user's email (15-min window)
 *  2. totp       — Time-based OTP (RFC 6238) compatible with Google Authenticator
 *
 * TOTP secret is AES-256-GCM encrypted before storage in Firestore.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHmac, createHash } from 'crypto';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { TwoFactorSetup } from '@/types';

// ─── Encryption helpers (TOTP secret at rest) ────────────────────────────────

const ENCRYPTION_KEY = Buffer.from(
  process.env.TRANSACTION_ENCRYPTION_KEY ?? '0'.repeat(64),
  'hex'
); // Must be 32 bytes (64 hex chars)

function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), encrypted.toString('hex'), tag.toString('hex')].join(':');
}

function decrypt(ciphertext: string): string {
  const [ivHex, encHex, tagHex] = ciphertext.split(':');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    ENCRYPTION_KEY,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
}

// ─── TOTP implementation ─────────────────────────────────────────────────────

/** Generate a 20-byte base32-encoded TOTP secret */
export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  return base32Encode(bytes);
}

/** Return the otpauth:// URI for QR code display */
export function buildTotpUri(secret: string, email: string, appName: string): string {
  const issuer = encodeURIComponent(appName);
  const account = encodeURIComponent(email);
  return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

/** Verify a 6-digit TOTP code (accepts ±1 time step for clock drift) */
export function verifyTotp(secret: string, code: string): boolean {
  const secretBytes = base32Decode(secret);
  const now = Math.floor(Date.now() / 1000 / 30);

  for (const step of [now - 1, now, now + 1]) {
    if (generateTotpCode(secretBytes, step) === code) return true;
  }
  return false;
}

function generateTotpCode(secretBytes: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter), 0);
  const hmac = createHmac('sha1', secretBytes).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

// ─── Email OTP ────────────────────────────────────────────────────────────────

/** Generate a cryptographically random 6-digit code */
export function generateEmailOtp(): string {
  const buf = randomBytes(3);
  const num = ((buf[0] << 16) | (buf[1] << 8) | buf[2]) % 1_000_000;
  return String(num).padStart(6, '0');
}

/** Store OTP in Firestore with 15-minute TTL */
export async function storeEmailOtp(uid: string, otp: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await adminDb.collection('users').doc(uid).collection('otp_codes').doc('2fa').set({
    codeHash: hashOtp(otp),
    expiresAt,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/** Verify and consume an email OTP (single use) */
export async function verifyEmailOtp(uid: string, code: string): Promise<boolean> {
  const ref = adminDb.collection('users').doc(uid).collection('otp_codes').doc('2fa');
  const snap = await ref.get();
  if (!snap.exists) return false;

  const { codeHash, expiresAt } = snap.data() as { codeHash: string; expiresAt: { toDate: () => Date } };
  if (new Date() > expiresAt.toDate()) {
    await ref.delete();
    return false;
  }

  const valid = codeHash === hashOtp(code);
  if (valid) await ref.delete(); // consume
  return valid;
}

function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

// ─── Backup codes ─────────────────────────────────────────────────────────────

export function generateBackupCodes(count = 8): { plaintext: string[]; hashed: string[] } {
  const plaintext = Array.from({ length: count }, () =>
    randomBytes(5).toString('hex').toUpperCase().replace(/(.{4})/g, '$1-').slice(0, -1)
  );
  const hashed = plaintext.map((c) => createHash('sha256').update(c).digest('hex'));
  return { plaintext, hashed };
}

export async function consumeBackupCode(uid: string, code: string): Promise<boolean> {
  const ref = adminDb.collection('users').doc(uid).collection('2fa').doc('setup');
  const snap = await ref.get();
  if (!snap.exists) return false;

  const setup = snap.data() as TwoFactorSetup;
  const hash = createHash('sha256').update(code.toUpperCase()).digest('hex');
  const idx = setup.backupCodes.indexOf(hash);
  if (idx === -1) return false;

  const remaining = setup.backupCodes.filter((_, i) => i !== idx);
  await ref.update({ backupCodes: remaining });
  return true;
}

// ─── Firestore CRUD ───────────────────────────────────────────────────────────

export async function enable2FA(
  uid: string,
  method: 'email_otp' | 'totp',
  secret?: string
): Promise<{ secret?: string; uri?: string; backupCodes: string[] }> {
  const { plaintext, hashed } = generateBackupCodes();
  const totpSecret = method === 'totp' ? (secret ?? generateTotpSecret()) : undefined;

  await adminDb
    .collection('users')
    .doc(uid)
    .collection('2fa')
    .doc('setup')
    .set({
      userId: uid,
      secret: totpSecret ? encrypt(totpSecret) : null,
      method,
      isVerified: false,
      backupCodes: hashed,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

  return { secret: totpSecret, backupCodes: plaintext };
}

export async function confirm2FASetup(uid: string): Promise<void> {
  await adminDb
    .collection('users')
    .doc(uid)
    .collection('2fa')
    .doc('setup')
    .update({ isVerified: true, updatedAt: FieldValue.serverTimestamp() });
}

export async function get2FASetup(uid: string): Promise<TwoFactorSetup | null> {
  const snap = await adminDb
    .collection('users')
    .doc(uid)
    .collection('2fa')
    .doc('setup')
    .get();

  if (!snap.exists) return null;
  const data = snap.data() as TwoFactorSetup & { secret: string | null };

  // Decrypt TOTP secret before returning
  if (data.secret) data.secret = decrypt(data.secret);
  return data;
}

export async function disable2FA(uid: string): Promise<void> {
  await adminDb.collection('users').doc(uid).collection('2fa').doc('setup').delete();
}

// ─── Base32 encode/decode (RFC 4648) ─────────────────────────────────────────

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(bytes: Buffer): string {
  let bits = 0, value = 0, output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_CHARS[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string): Buffer {
  const lookup: Record<string, number> = {};
  BASE32_CHARS.split('').forEach((c, i) => (lookup[c] = i));

  let bits = 0, value = 0;
  const output: number[] = [];
  for (const char of input.toUpperCase().replace(/=+$/, '')) {
    value = (value << 5) | (lookup[char] ?? 0);
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}