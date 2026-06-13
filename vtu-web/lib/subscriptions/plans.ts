// vtu-web/lib/subscriptions/plans.ts
// AGENTS.md RULES: #13 (config from Firestore), #14 (runtime config)

// IMPORTS NEEDED:
// - adminDb from @/lib/firebase/admin
// - SubscriptionPlan type from @/types
// - logExternalCall from @/lib/utils/logger

// ─── SUBSCRIPTION PLANS ───────────────────────────────────────────────────────

// FUNCTION: getActivePlans()
// PURPOSE : Return all active subscription plans for display and enforcement.
// RETURNS : Promise<SubscriptionPlan[]>
//
// STEPS:
//   1. Query subscription_plans where isActive == true ordered by displayOrder.
//   2. Map Firestore docs to SubscriptionPlan objects.
//   3. Return plan list.

// FUNCTION: getPlanById(planId)
// PURPOSE : Return a single subscription plan by ID.
// PARAMS  : planId: string
// RETURNS : Promise<SubscriptionPlan | null>
//
// STEPS:
//   1. Read subscription_plans/{planId}.
//   2. Return mapped plan or null if not found.

// FUNCTION: validateUserPlan(userId)
// PURPOSE : Check subscription status and limit enforcement for a user.
// PARAMS  : userId: string
// RETURNS : Promise<UserSubscriptionStatus>
//
// STEPS:
//   1. Read user document and plan document.
//   2. Determine if subscription is active and not expired.
//   3. Return status with allowed features and limits.
