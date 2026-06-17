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