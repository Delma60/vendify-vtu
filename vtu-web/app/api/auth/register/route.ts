// vtu-web/app/api/auth/register/route.ts
import { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { RegisterSchema } from '@/lib/utils/validators';
import { ok, err, parseIp } from '@/lib/utils/response';
import { generateEmailOtp, storeEmailOtp } from '@/lib/auth/twoFactor';
import { sendEmailVerification } from '@/lib/mail/client';
import { randomBytes } from 'crypto';

function generateReferralCode(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

async function resolveReferredBy(referralCode?: string): Promise<string | null> {
  if (!referralCode) return null;
  const snap = await adminDb
    .collection('users')
    .where('referralCode', '==', referralCode)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return err((parsed.error as any).errors[0].message, 422);
  }

  const { email, password, displayName, phone, referralCode } = parsed.data;

  // Check duplicate email
  try {
    await getAuth().getUserByEmail(email);
    return err('An account with this email already exists', 409);
  } catch {
    // Not found — expected
  }

  // Check duplicate phone
  try {
    await getAuth().getUserByPhoneNumber(phone.startsWith('+') ? phone : `+234${phone.slice(1)}`);
    return err('An account with this phone number already exists', 409);
  } catch {
    // Not found — expected
  }

  // Create Firebase Auth user
  let firebaseUser;
  try {
    firebaseUser = await getAuth().createUser({
      email,
      password,
      displayName,
      emailVerified: false,
    });
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/email-already-exists') return err('Email already in use', 409);
    console.error('[register] Firebase Auth error', e);
    return err('Failed to create account', 500);
  }

  const uid = firebaseUser.uid;
  const referredBy = await resolveReferredBy(referralCode);
  const userReferralCode = generateReferralCode();

  // Create Firestore user doc + wallet doc atomically
  const batch = adminDb.batch();

  batch.set(adminDb.collection('users').doc(uid), {
    uid,
    email,
    phone,
    displayName,
    avatar: null,
    roleId: 'customer',
    kycTier: 0,
    referralCode: userReferralCode,
    referredBy,
    isActive: true,
    isFrozen: false,
    transactionPin: null,
    subscriptionPlanId: 'free',
    subscriptionExpiresAt: null,
    parentResellerId: null,
    resellerLevel: 0,
    hasBucket: false,
    riskLevel: 'low',
    spendingLimits: {
      dailyLimit: null,
      weeklyLimit: null,
      dailySpent: 0,
      weeklySpent: 0,
      lastResetDate: new Date().toISOString().slice(0, 10),
    },
    notifications: { email: true, sms: true, push: true, whatsapp: false },
    fcmTokens: [],
    whatsappNumber: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  batch.set(adminDb.collection('wallets').doc(uid), {
    userId: uid,
    balance: 0,
    currency: 'NGN',
    virtualAccountNumber: '',
    virtualAccountBank: '',
    virtualAccountRef: '',
    totalFunded: 0,
    totalSpent: 0,
    totalWithdrawn: 0,
    lockedBalance: 0,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  // Send email verification OTP
  const otp = generateEmailOtp();
  await storeEmailOtp(uid, otp);
  await sendEmailVerification(email, otp, displayName).catch((e) =>
    console.error('[register] Failed to send verification email', e)
  );

  // Async: create Flutterwave virtual account (non-blocking, retried if it fails)
  createVirtualAccountAsync(uid, { email, phone, name: displayName }).catch((e) =>
    console.error('[register] Virtual account creation failed — will retry on next login', e)
  );

  return ok({ uid, email }, 'Account created. Check your email for a verification code.', 201);
}

async function createVirtualAccountAsync(
  uid: string,
  customerDetails: { email: string; phone: string; name: string }
): Promise<void> {
  try {
    const { createVirtualAccount } = await import('@/lib/flutterwave/virtual-accounts');
    await createVirtualAccount(uid, customerDetails);
  } catch (error) {
    // Store a flag to retry on next user session
    await adminDb.collection('pending_virtual_accounts').doc(uid).set({
      uid,
      customerDetails,
      failedAt: FieldValue.serverTimestamp(),
      retryCount: 0,
    });
  }
}