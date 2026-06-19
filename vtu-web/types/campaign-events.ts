// vtu-web/types/campaign-events.ts
// AGENTS.md RULES: #1 (kobo), #8 (never hard-delete), #13 (config from Firestore)

import { Timestamp } from 'firebase-admin/firestore';

// ─── Rewards ──────────────────────────────────────────────────────────────────

export type RewardType = 'wallet_credit' | 'loyalty_points' | 'badge';

export interface CampaignEventReward {
  type: RewardType;
  walletCreditKobo?: number;  // required if type === 'wallet_credit'
  loyaltyPoints?: number;     // required if type === 'loyalty_points'
  badgeId?: string;           // required if type === 'badge'
  badgeLabel?: string;
}

// ─── Targeting ────────────────────────────────────────────────────────────────

export type CampaignEventSegment =
  | 'all'
  | 'new_users'        // account created on/after campaign startDate
  | 'kyc_tier_1'
  | 'kyc_tier_2'
  | 'plan_starter'
  | 'plan_pro'
  | 'plan_enterprise';

// ─── Definition (admin-created, free-form, shareable) ─────────────────────────

export interface CampaignEventDefinition {
  id: string;
  name: string;
  description: string;

  eventKey: string;          // stable machine key — can also be fired from anywhere via API
  shareSlug: string;         // public link: /e/{shareSlug}

  rewards: CampaignEventReward[];

  userSegment: CampaignEventSegment;

  // Caps — 0 means unlimited
  maxClaimsPerUser: number;  // usually 1 (one-time reward)
  maxTotalClaims: number;
  totalBudgetKobo: number;   // only enforced against wallet_credit rewards

  startDate: Timestamp;
  endDate: Timestamp;

  isActive: boolean;
  isArchived: boolean;

  // Counters (denormalized)
  totalClaimedCount: number;
  totalPaidKobo: number;
  totalPointsAwarded: number;

  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Claim log (idempotency + analytics) ───────────────────────────────────────

export interface CampaignEventClaim {
  id: string;
  eventDefId: string;
  eventKey: string;
  userId: string;
  rewardsGiven: CampaignEventReward[];
  source: 'link' | 'api' | 'manual';
  ip: string | null;
  createdAt: Timestamp;
}

// ─── Loyalty points ledger ─────────────────────────────────────────────────────

export interface LoyaltyPointsLedgerEntry {
  id: string;
  userId: string;
  amount: number;             // positive = earn, negative = redeem/adjustment
  balanceAfter: number;
  source: 'campaign_event' | 'redemption' | 'admin_adjustment';
  eventDefId?: string;
  note?: string;
  createdAt: Timestamp;
}

// ─── Badges ────
// ────────────────────────────────────────────────────────────────

export interface UserBadge {
  id: string;                 // deterministic: `${userId}_${eventDefId}`
  userId: string;
  badgeId: string;
  badgeLabel: string;
  eventDefId: string;
  awardedAt: Timestamp;
}