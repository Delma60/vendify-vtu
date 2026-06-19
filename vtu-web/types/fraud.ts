// vtu-web/types/fraud.ts
// AGENTS.md RULES: #1 (kobo), #8 (never hard-delete), #13 (config from Firestore)

import { Timestamp } from 'firebase-admin/firestore';

// ─── Signals & scoring ────────────────────────────────────────────────────────

export interface FraudSignal {
  name: string;
  weight: number;        // contribution to score (0-100 total) if detected
  detected: boolean;
}

export type FraudDecision = 'approved' | 'flagged' | 'blocked';

export interface FraudCheckResult {
  checkId: string;
  score: number;          // 0-100
  decision: FraudDecision;
  signals: FraudSignal[];
}

// ─── Persisted fraud check (history — one per scored transaction attempt) ────
// Collection: fraud_checks
// This is what powers "fraud score history per user" — every score computed,
// not just the ones that got flagged or blocked.

export interface FraudCheckRecord {
  id: string;
  userId: string;
  service: string;
  amountKobo: number;
  ip: string;
  phone: string | null;
  reference: string | null;
  score: number;
  decision: FraudDecision;
  signals: FraudSignal[];
  createdAt: Timestamp;
}

// ─── Review queue entry ────────────────────────────────────────────────────────
// Collection: fraud_flags
// Created whenever decision !== 'approved'. 'open' = 30-70 band, needs human
// review. 'escalated' = >70, auto-rejected but still surfaced for visibility.

export type FraudFlagStatus = 'open' | 'escalated' | 'approved' | 'rejected';

export interface FraudFlag {
  id: string;
  checkId: string;
  userId: string;
  service: string;
  amountKobo: number;
  ip: string;
  phone: string | null;
  reference: string | null;
  score: number;
  signals: FraudSignal[];
  status: FraudFlagStatus;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  resolvedAt: Timestamp | null;
}

// ─── IP blacklist ──────────────────────────────────────────────────────────────
// Collection: ip_blacklist (matches the model already documented in AGENTS.md)

export interface IpBlacklistEntry {
  id: string;
  ip: string;             // single IPv4 address or CIDR range, e.g. '196.44.0.0/16'
  reason: string;
  addedBy: string;        // admin userId, or 'system' for auto-blacklist
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}