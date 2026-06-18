// lib/events/engine.ts
import { adminDb } from "@/lib/firebase/admin";
import { debitWallet } from "@/lib/wallet/operations";
import { generateReference } from "@/lib/utils/reference";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import crypto from "crypto";

export async function purchaseEventTicket({
  userId,
  eventId,
  tierId,
  idempotencyKey
}: {
  userId: string;
  eventId: string;
  tierId: string;
  idempotencyKey: string;
}) {
  // 1. Fetch Event and validate
  const eventRef = adminDb.collection('events').doc(eventId);
  const eventSnap = await eventRef.get();
  
  if (!eventSnap.exists) throw new Error("Event not found");
  const eventData = eventSnap.data() as PlatformEvent;
  
  if (eventData.isDeleted || eventData.status !== 'upcoming') {
    throw new Error("This event is no longer active");
  }

  // 2. Find Tier & check capacity
  const tierIndex = eventData.ticketTiers.findIndex(t => t.id === tierId);
  if (tierIndex === -1) throw new Error("Ticket tier not found");
  
  const tier = eventData.ticketTiers[tierIndex];
  if (tier.sold >= tier.capacity) {
    throw new Error("This ticket tier is sold out");
  }

  // 3. Generate References & Secure QR Data
  const transactionRef = generateReference('EVT'); // Custom prefix for Events
  const ticketId = `TKT-${generateReference('')}`;
  
  // Secure QR payload: TicketID + EventID + Secret HMAC
  const qrSignature = crypto.createHmac('sha256', process.env.TRANSACTION_ENCRYPTION_KEY!)
    .update(`${ticketId}:${eventId}`)
    .digest('hex');
  const qrCodeData = `${ticketId}:${eventId}:${qrSignature}`;

  // 4. Debit Wallet (Atomic Operation handles balance & fraud checks internally)
  const transactionId = await debitWallet(
    userId,
    tier.price, // Already in Kobo
    {
      category: 'event_ticket',
      reference: transactionRef,
      metadata: { eventId, tierId, ticketId, eventName: eventData.name }
    },
    idempotencyKey
  );

  // 5. Update Event Inventory & Generate Ticket (Atomic Batch)
  const batch = adminDb.batch();
  
  // Update tickets sold count
  const updatedTiers = [...eventData.ticketTiers];
  updatedTiers[tierIndex].sold += 1;
  batch.update(eventRef, { 
    ticketTiers: updatedTiers,
    updatedAt: FieldValue.serverTimestamp()
  });

  // Create User Ticket
  const ticketRef = adminDb.collection('tickets').doc(ticketId);
  batch.set(ticketRef, {
    id: ticketId,
    eventId,
    tierId,
    userId,
    transactionId,
    qrCodeData,
    status: 'valid',
    purchasedAt: FieldValue.serverTimestamp(),
    usedAt: null
  });

  await batch.commit();

  return { success: true, ticketId, transactionId };
}