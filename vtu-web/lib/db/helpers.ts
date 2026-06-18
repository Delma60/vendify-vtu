'use server';
// import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { User, Network, DataPlan, Wallet, Transaction, NetworkType } from '@/types';
import { env } from '@/lib/utils/env';
import { adminDb } from '../firebase/admin';


// export const baseUrl = env("BASE_URL", 'http://localhost:3000');
// ============================================================================
// 1. USERS HELPERS
// ============================================================================

export async function getUser(uid: string): Promise<User | null> {
  const snap = await adminDb.collection('users').doc(uid).get();
  return snap.exists ? (snap.data() as User) : null;
}

export async function createUser(uid: string, data: Partial<User>): Promise<void> {
  const userRef = adminDb.collection('users').doc(uid);
  await userRef.set({
    uid,
    isActive: true,
    isFrozen: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...data,
  });
}

export async function updateUser(uid: string, data: Partial<User>): Promise<void> {
  const userRef = adminDb.collection('users').doc(uid);
  await userRef.update({
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function deactivateUser(uid: string): Promise<void> {
  // Soft delete / Deactivation
  const userRef = adminDb.collection('users').doc(uid);
  await userRef.update({
    isActive: false,
    updatedAt: Timestamp.now(),
  });
}


// ============================================================================
// 2. NETWORKS HELPERS
// ============================================================================

export async function getNetwork(networkId: string): Promise<Network | null> {
  const snap = await adminDb.collection('networks').doc(networkId).get();
  return snap.exists ? (snap.data() as Network) : null;
}

export async function getAllNetworks(): Promise<Network[]> {
  const snap = await adminDb.collection('networks').where('isActive', '==', true).get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Network));
}

export async function createNetwork(data: Partial<Network>): Promise<string> {
  const ref = adminDb.collection('networks').doc();
  await ref.set({
    id: ref.id,
    isActive: true,
    ...data,
  });
  return ref.id;
}

export async function updateNetwork(networkId: string, data: Partial<Network>): Promise<void> {
  await adminDb.collection('networks').doc(networkId).update(data);
}

export async function deactivateNetwork(networkId: string): Promise<void> {
  await adminDb.collection('networks').doc(networkId).update({ isActive: false });
}


// ============================================================================
// 3. DATA PLANS HELPERS
// ============================================================================

export async function getDataPlan(planId: string): Promise<DataPlan | null> {
  const snap = await adminDb.collection('data_plans').doc(planId).get();
  return snap.exists ? (snap.data() as DataPlan) : null;
}

export async function getActiveDataPlansByNetwork(network: string): Promise<DataPlan[]> {
  const snap = await adminDb.collection('data_plans')
    .where('network', '==', network)
    .get();
  
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DataPlan));
}

export async function createDataPlan(data: Partial<DataPlan>): Promise<string> {
  
  const ref = adminDb.collection('data_plans').doc();
  await ref.set({
    id: ref.id,
    ...data,
    createAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    isActive: true,
  });
  return ref.id;
}

export async function updateDataPlan(planId: string, data: Partial<DataPlan>): Promise<void> {
  await adminDb.collection('data_plans').doc(planId).update(data);
}


// ============================================================================
// 4. WALLET HELPERS (Initialization)
// Note: Operations (debit/credit) are already handled securely in wallet/operations.ts
// ============================================================================

export async function initializeWallet(uid: string): Promise<void> {
  const walletRef = adminDb.collection('wallets').doc(uid);
  const snap = await walletRef.get();
  
  if (!snap.exists) {
    await walletRef.set({
      userId: uid,
      balance: 0, // ALWAYS in kobo (integer)
      currency: 'NGN',
      totalFunded: 0,
      totalSpent: 0,
      totalWithdrawn: 0,
      lockedBalance: 0,
      updatedAt: Timestamp.now(),
    } as Partial<Wallet>);
  }
}


// ============================================================================
// 5. TRANSACTIONS HELPERS (Reads)
// Note: Creation is handled via debitWallet/creditWallet in wallet/operations.ts
// ============================================================================

export async function getTransactionById(txnId: string): Promise<Transaction | null> {
  const snap = await adminDb.collection('transactions').doc(txnId).get();
  return snap.exists ? (snap.data() as Transaction) : null;
}

export async function getTransactionsByReference(reference: string): Promise<Transaction[]> {
  const snap = await adminDb.collection('transactions')
    .where('reference', '==', reference)
    .get();
    
  return snap.docs.map(doc => doc.data() as Transaction);
}


// ============================================================================
// 6. CABLE PLANS HELPERS (Similar to Data Plans)
// ============================================================================

export interface CablePlan {
  id: string;
  provider: string; // e.g., 'DSTV', 'GOTV'
  name: string;
  price: number;    // in kobo
  providerPlanId: string;
  isActive: boolean;
}

export async function getCablePlansByProvider(provider: string): Promise<CablePlan[]> {
  const snap = await adminDb.collection('cable_plans')
    .where('provider', '==', provider)
    .where('isActive', '==', true)
    .get();
    
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CablePlan));
}

export async function createCablePlan(data: Partial<CablePlan>): Promise<string> {
  const ref = adminDb.collection('cable_plans').doc();
  await ref.set({
    id: ref.id,
    isActive: true,
    ...data,
  });
  return ref.id;
}


// ============================================================================
// NETWORK TYPES HELPERS
// ============================================================================

/**
 * Retrieves a single network type by its ID.
 */
export async function getNetworkType(typeId: string): Promise<NetworkType | null> {
  const snap = await adminDb.collection('network_types').doc(typeId).get();
  return snap.exists ? (snap.data() as NetworkType) : null;
}

/**
 * Retrieves all active network types.
 */
export async function getAllNetworkTypes(): Promise<NetworkType[]> {
  const snap = await adminDb.collection('network_types')
    .where('isActive', '==', true)
    .get();
    
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as NetworkType));
}

/**
 * Retrieves network types associated with a specific network (e.g., all MTN types).
 */
export async function getNetworkTypesByNetwork(networkId: string): Promise<NetworkType[]> {
  const snap = await adminDb.collection('network_types')
    .where('networkId', '==', networkId)
    .where('isActive', '==', true)
    .get();
    
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as NetworkType));
}

/**
 * Creates a new network type.
 */
export async function createNetworkType(data: Partial<NetworkType>): Promise<string> {
  const ref = adminDb.collection('network_types').doc();
  
  await ref.set({
    id: ref.id,
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...data,
  });
  
  return ref.id;
}

/**
 * Updates an existing network type.
 */
export async function updateNetworkType(typeId: string, data: Partial<NetworkType>): Promise<void> {
  const ref = adminDb.collection('network_types').doc(typeId);
  console.log(typeId)
  
  await ref.update({
    ...data,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Soft-deletes a network type to preserve historical transaction relationships.
 */
export async function deactivateNetworkType(typeId: string): Promise<void> {
  const ref = adminDb.collection('network_types').doc(typeId);
  
  await ref.update({ 
    isActive: false,
    updatedAt: Timestamp.now()
  });
}

// ============================================================================
// AIRTIME DISCOUNTS HELPERS
// ============================================================================

// {
//     network: "mtn",
//     type: "VTU",
//     provider: "vtpass",
//     isActive: true,
//     minAmount: "50",
//     maxAmount: "5000",
//     roleDiscounts: {
//       customer: "2.0",
//       agent: "2.5",
//       reseller: "3.0",
//       api: "3.5",
//     } as Record<string, string>,
//   }
export interface AirtimeDiscount {
  id: string;
  network: string;
  type: string;
  minAmountKobo: number;
  maxAmountKobo: number;
  provider: string;
  roleDiscounts: Record<string, number>
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: string|Timestamp;
  createdAt?: string|Timestamp;
  updatedAt?: string|Timestamp;
}

/**
 * Retrieves a single airtime discount by its ID.
 */
export async function getAirtimeDiscount(id: string): Promise<AirtimeDiscount | null> {
  const snap = await adminDb.collection('airtime_discounts').doc(id).get();
  const data = snap.data();
  
  // Return null if it doesn't exist or was soft-deleted
  if (!snap.exists || data?.isDeleted) return null;
  
  return data as AirtimeDiscount;
}

/**
 * Retrieves all active (non-deleted) airtime discounts.
 */
export async function getAllAirtimeDiscounts(): Promise<AirtimeDiscount[]> {
  const snap = await adminDb.collection('airtime_discounts')
    .where('isDeleted', '==', false)
    .get();
  if(snap.empty) return []
    
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AirtimeDiscount));
}

/**
 * Retrieves discounts associated with a specific network.
 */
export async function getAirtimeDiscountsByNetwork(networkId: string): Promise<AirtimeDiscount[]> {
  const snap = await adminDb.collection('airtime_discounts')
    .where('network', '==', networkId)
    .where('isDeleted', '==', false)
    .get();
    
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AirtimeDiscount));
}

/**
 * Creates a new airtime discount.
 */
export async function createAirtimeDiscount(data: Partial<AirtimeDiscount>): Promise<string> {
  const ref = adminDb.collection('airtime_discounts').doc();
  
  await ref.set({
    id: ref.id,
    isActive: true,
    isDeleted: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...data,
  });
  
  return ref.id;
}

/**
 * Updates an existing airtime discount.
 */
export async function updateAirtimeDiscount(id: string, data: Partial<AirtimeDiscount>): Promise<void> {
  const ref = adminDb.collection('airtime_discounts').doc(id);
  
  await ref.update({
    ...data,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Soft-deletes an airtime discount (Complies with AGENTS.md Rule #8).
 */
export async function deleteAirtimeDiscount(id: string): Promise<void> {
  const ref = adminDb.collection('airtime_discounts').doc(id);
  
  await ref.update({
    isActive: false,
    isDeleted: true,
    deletedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}



// ============================================================================
// PROVIDERS HELPERS
// ============================================================================

export interface ProviderConfig {
  id: string;
  name: string;             // e.g., 'VTPass', 'Simhost NG'
  code: string;             // e.g., 'vtpass', 'simhost', 'bilal'
  isActive: boolean;
  supportsPricePullAPI: boolean;
  baseUrl?: string;
  isDeleted?: boolean;
  deletedAt?: string|Timestamp;
  createdAt?: string|Timestamp;
  updatedAt?: string|Timestamp;
}

/**
 * Retrieves a single provider configuration by its ID.
 */
export async function getProvider(id: string): Promise<ProviderConfig | null> {
  const snap = await adminDb.collection('providers').doc(id).get();
  const data = snap.data();
  
  // Return null if it doesn't exist or was soft-deleted
  if (!snap.exists || data?.isDeleted) return null;
  
  return data as ProviderConfig;
}

/**
 * Retrieves a single provider by its code (e.g., 'vtpass').
 */
export async function getProviderByCode(code: string): Promise<ProviderConfig | null> {
  const snap = await adminDb.collection('providers')
    .where('code', '==', code)
    .where('isDeleted', '==', false)
    .limit(1)
    .get();
    
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as ProviderConfig;
}

/**
 * Retrieves all active (non-deleted) providers.
 */
export async function getAllProviders(): Promise<ProviderConfig[]> {
  const snap = await adminDb.collection('providers')
    .where('isDeleted', '==', false)
    .get();
    
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProviderConfig));
}

/**
 * Retrieves only active and enabled providers.
 */
export async function getActiveProviders(): Promise<ProviderConfig[]> {
  const snap = await adminDb.collection('providers')
    // .where('isDeleted', '==', false)
    .where('isActive', '==', true)
    .get();
    
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProviderConfig));
}

/**
 * Creates a new provider configuration.
 */
export async function createProvider(data: Partial<ProviderConfig>): Promise<string> {
  const ref = adminDb.collection('providers').doc();
  
  await ref.set({
    id: ref.id,
    isActive: true,
    supportsPricePullAPI: data.supportsPricePullAPI ?? false,
    isDeleted: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...data,
  });
  
  return ref.id;
}

/**
 * Updates an existing provider configuration.
 */
export async function updateProvider(id: string, data: Partial<ProviderConfig>): Promise<void> {
  const ref = adminDb.collection('providers').doc(id);
  
  await ref.update({
    ...data,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Soft-deletes a provider (Complies with AGENTS.md Rule #8).
 */
export async function deleteProvider(id: string): Promise<void> {
  const ref = adminDb.collection('providers').doc(id);
  
  await ref.update({
    isActive: false,
    isDeleted: true,
    deletedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}