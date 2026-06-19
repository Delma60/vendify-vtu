// vtu-web/lib/payments/factory.ts
// AGENTS.md RULES: #13 (config from Firestore), #14 (runtime config)

import type { PaymentGatewayInterface } from './interface';
import type { PaymentGatewayConfig, PaymentGatewayRegistryEntry } from '@/types/payment';

type GatewayConstructor = new (config: PaymentGatewayConfig) => PaymentGatewayInterface;

/**
 * Each entry pairs the implementation class with its UI metadata.
 * When you add a new payment gateway:
 *   1. Write a class extending PaymentGatewayBase and implementing PaymentGatewayInterface.
 *   2. Add it here with its PaymentGatewayRegistryEntry so the admin UI can list it.
 *   3. Add a `payment_gateways` Firestore document with code matching the key below.
 *
 * No env vars, no code deploy to switch active gateway — same pattern as
 * lib/providers/factory.ts for VTU providers (rule #13).
 */
interface RegistryEntry {
  cls: GatewayConstructor;
  meta: PaymentGatewayRegistryEntry;
}

// Import implementations
import { FlutterwaveGateway } from './implementations/FlutterwaveGateway';
// import { SandboxGateway } from './implementations/sandbox';

const REGISTRY: Record<string, RegistryEntry> = {
  flutterwave: {
    cls: FlutterwaveGateway,
    meta: {
      code: 'flutterwave',
      label: 'Flutterwave',
      authMethod: 'public_secret',
      credentialHints: {
        publicKey: 'FLWPUBK_...',
        secretKey: 'FLWSECK_...',
        encryptionKey: '12-char encryption key',
        webhookSecret: 'Your verif-hash secret from Flutterwave dashboard',
      },
      defaultCapabilities: ['fund', 'payout', 'virtual_account', 'card'],
      docsUrl: 'https://developer.flutterwave.com/docs',
    },
  },
//   sandbox: {
//     cls: SandboxGateway,
//     meta: {
//       code: 'sandbox',
//       label: 'Sandbox (Testing)',
//       authMethod: 'secret_key',
//       credentialHints: {
//         secretKey: 'any-value-works',
//       },
//       defaultCapabilities: ['fund', 'payout', 'virtual_account', 'card'],
//     },
//   },
  // Add more gateways here:
  // paystack: { cls: PaystackGateway, meta: { ... } },
  // monnify:  { cls: MonnifyGateway,  meta: { ... } },
};

export class PaymentGatewayFactory {
  /**
   * Instantiate the correct gateway class for a given DB config.
   * If USE_SANDBOX=true, every gateway resolves to the sandbox stub —
   * mirrors ProviderFactory.make() behaviour exactly.
   */
  static make(config: PaymentGatewayConfig): PaymentGatewayInterface {
    const useSandbox = process.env.USE_SANDBOX === 'true';
    const key = useSandbox ? 'sandbox' : config.code;
    console.log(`PaymentGatewayFactory: making gateway for code "${key}" (sandbox=${useSandbox})`);

    const entry = REGISTRY[key];
    if (!entry) {
      throw new Error(
        `PaymentGatewayFactory: no implementation registered for code "${config.code}". ` +
        `Available codes: ${Object.keys(REGISTRY).join(', ')}`
      );
    }

    return new entry.cls(config);
  }

  /**
   * Returns UI metadata for all registered gateways.
   * Used by the admin "Add payment gateway" form to populate the code
   * dropdown and conditionally show the right credential fields.
   */
  static getRegistry(): PaymentGatewayRegistryEntry[] {
    return Object.values(REGISTRY)
      .map(e => e.meta)
      .filter(m => m.code !== 'sandbox' || process.env.NODE_ENV !== 'production');
  }

  /** Returns metadata for a specific gateway code. */
  static getMeta(code: string): PaymentGatewayRegistryEntry | null {
    return REGISTRY[code]?.meta ?? null;
  }

  /** Allows registering gateways from outside this module (e.g. tests). */
  static register(code: string, cls: GatewayConstructor, meta: PaymentGatewayRegistryEntry): void {
    REGISTRY[code] = { cls, meta };
  }

  static isRegistered(code: string): boolean {
    return code in REGISTRY;
  }
}