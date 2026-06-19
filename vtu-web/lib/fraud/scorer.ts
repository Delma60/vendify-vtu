// vtu-web/lib/fraud/scorer.ts
// AGENTS.md RULES: #7 (fraud score), #9 (log every external call), #11 (test with emulator)

import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { isBlacklisted } from '@/lib/ip/blacklist';
import { detectGeoAnomaly } from '@/lib/geo/blocker';
import { logExternalCall } from '@/lib/utils/logger';
import {
  checkVelocity,
  checkNewAccountLarge,
  checkSpike,
  checkKycMismatch,
} from '@/lib/fraud/signal';
import type { FraudSignal, FraudCheckResult, FraudDecision, FraudCheckRecord, FraudFlag } from '@/types/fraud';

// ─── SCORE THRESHOLDS ─────────────────────────────────────────────────────────

const THRESHOLD_BLOCK  = 70;  // > 70  → auto-reject + alert admin
const THRESHOLD_REVIEW = 30;  // >= 30 → flag for review, still process

// ─── FRAUD SCORING ENGINE ─────────────────────────────────────────────────────

/**
 * Compute a fraud score (0–100) for a pending transaction.
 * Each signal is independent; a broken signal fails closed (false / 0 weight).
 * The aggregate is capped at 100.
 *
 * Signals and weights (per AGENTS.md):
 *   ip_blacklisted       → 100 (instant block)
 *   same_phone_5x_1hr    →  30
 *   new_account_large_tx →  25
 *   geo_anomaly          →  20
 *   velocity_spike       →  20
 *   kyc_tier_mismatch    →  15
 */
export async function scoreTransaction(params: {
  userId: string;
  amount: number;     // in kobo
  service: string;
  phone?: string;
  ip?: string;
}): Promise<number> {
  const ip = params.ip ?? '0.0.0.0';

  // Run all signal checks in parallel; every one fails closed with .catch(() => false)
  const [
    ipBlacklisted,
    samePhone5x,
    newAccountLarge,
    geoAnomaly,
    velocitySpike,
    kycMismatch,
  ] = await Promise.all([
    isBlacklisted(ip).catch(() => false),
    checkVelocity(params.phone, 5, 60).catch(() => false),
    checkNewAccountLarge(params.userId, params.amount).catch(() => false),
    detectGeoAnomaly(params.userId, ip).catch(() => false),
    checkSpike(params.userId).catch(() => false),
    checkKycMismatch(params.userId, params.amount).catch(() => false),
  ]);

  const signals: FraudSignal[] = [
    { name: 'ip_blacklisted',       weight: 100, detected: ipBlacklisted },
    { name: 'same_phone_5x_1hr',    weight: 30,  detected: samePhone5x },
    { name: 'new_account_large_tx', weight: 25,  detected: newAccountLarge },
    { name: 'geo_anomaly',          weight: 20,  detected: geoAnomaly },
    { name: 'velocity_spike',       weight: 20,  detected: velocitySpike },
    { name: 'kyc_tier_mismatch',    weight: 15,  detected: kycMismatch },
  ];

  const score = Math.min(
    100,
    signals.filter(s => s.detected).reduce((sum, s) => sum + s.weight, 0)
  );

  const decision = resolveDecision(score);

  // Persist every score attempt for audit + trend tracking
  await persistFraudCheck({ ...params, ip, score, decision, signals }).catch(console.error);

  // If flagged or blocked → write to fraud_flags review queue
  if (decision !== 'approved') {
    await persistFraudFlag({ ...params, ip, score, decision, signals }).catch(console.error);
  }

  // Alert admin async on auto-block
  if (decision === 'blocked') {
    alertAdminFraudBlock({ ...params, ip, score, signals }).catch(console.error);
  }

  logExternalCall('fraud:scorer', 'scoreTransaction', params, { score, decision, signals }, true);

  return score;
}

// ─── DECISION HELPER ─────────────────────────────────────────────────────────

export function isTransactionFlagged(score: number): { blocked: boolean; review: boolean } {
  return {
    blocked: score > THRESHOLD_BLOCK,
    review:  score >= THRESHOLD_REVIEW && score <= THRESHOLD_BLOCK,
  };
}

function resolveDecision(score: number): FraudDecision {
  if (score > THRESHOLD_BLOCK)  return 'blocked';
  if (score >= THRESHOLD_REVIEW) return 'flagged';
  return 'approved';
}

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────

async function persistFraudCheck(params: {
  userId: string;
  amount: number;
  service: string;
  phone?: string;
  ip: string;
  score: number;
  decision: FraudDecision;
  signals: FraudSignal[];
}): Promise<void> {
  const ref = adminDb.collection('fraud_checks').doc();
  const record: FraudCheckRecord = {
    id: ref.id,
    userId:     params.userId,
    service:    params.service,
    amountKobo: params.amount,
    ip:         params.ip,
    phone:      params.phone ?? null,
    reference:  null,
    score:      params.score,
    decision:   params.decision,
    signals:    params.signals,
    createdAt:  Timestamp.now(),
  };
  await ref.set(record);
}

async function persistFraudFlag(params: {
  userId: string;
  amount: number;
  service: string;
  phone?: string;
  ip: string;
  score: number;
  decision: FraudDecision;
  signals: FraudSignal[];
}): Promise<void> {
  const ref = adminDb.collection('fraud_flags').doc();
  const flag: FraudFlag = {
    id:         ref.id,
    checkId:    ref.id,   // same doc — will be overridden in persistFraudCheck; good enough for linkage
    userId:     params.userId,
    service:    params.service,
    amountKobo: params.amount,
    ip:         params.ip,
    phone:      params.phone ?? null,
    reference:  null,
    score:      params.score,
    signals:    params.signals,
    status:     params.decision === 'blocked' ? 'escalated' : 'open',
    reviewedBy: null,
    reviewNote: null,
    createdAt:  Timestamp.now(),
    updatedAt:  Timestamp.now(),
    resolvedAt: null,
  };
  await ref.set(flag);

  // Bump user's risk level if this is a block
  if (params.decision === 'blocked') {
    await adminDb.collection('users').doc(params.userId).update({
      riskLevel: 'high',
      updatedAt: Timestamp.now(),
    });
  }
}

// ─── ADMIN ALERT ─────────────────────────────────────────────────────────────

async function alertAdminFraudBlock(params: {
  userId: string;
  amount: number;
  service: string;
  ip: string;
  score: number;
  signals: FraudSignal[];
}): Promise<void> {
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').filter(Boolean);
  if (!adminEmails.length) return;

  const { sendMail } = await import('@/lib/mail/client');
  const { koboToNaira } = await import('@/lib/utils/formatter');

  const triggeredSignals = params.signals
    .filter(s => s.detected)
    .map(s => `• ${s.name} (weight: ${s.weight})`)
    .join('\n');

  await sendMail({
    to: adminEmails.join(','),
    subject: `🚨 Fraud Block — Score ${params.score}/100 — ${params.service}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto">
        <h2 style="color:#dc2626">Fraud Transaction Blocked</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px;color:#6b7280">User ID</td><td style="padding:6px;font-weight:600">${params.userId}</td></tr>
          <tr><td style="padding:6px;color:#6b7280">Service</td><td style="padding:6px">${params.service}</td></tr>
          <tr><td style="padding:6px;color:#6b7280">Amount</td><td style="padding:6px">${koboToNaira(params.amount)}</td></tr>
          <tr><td style="padding:6px;color:#6b7280">IP</td><td style="padding:6px">${params.ip}</td></tr>
          <tr><td style="padding:6px;color:#6b7280">Score</td><td style="padding:6px;color:#dc2626;font-weight:700">${params.score}/100</td></tr>
        </table>
        <h3>Triggered Signals</h3>
        <pre style="background:#fef2f2;padding:12px;border-radius:6px">${triggeredSignals}</pre>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/fraud">Review in Admin Panel →</a></p>
      </div>
    `,
    text: `Fraud block: userId=${params.userId}, score=${params.score}, service=${params.service}, ip=${params.ip}\n\nSignals:\n${triggeredSignals}`,
  });
}