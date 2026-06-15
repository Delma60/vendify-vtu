// vtu-web/lib/providers/factory.ts
// AGENTS.md RULES: #13 (config from Firestore), #14 (runtime config)

import type { VTUProviderInterface } from './interface';
import type { ProviderConfig, ProviderRegistryEntry } from '@/types/provider';

type ProviderConstructor = new (config: ProviderConfig) => VTUProviderInterface;

/**
 * Each entry pairs the implementation class with its UI metadata.
 * When you add a new vendor:
 *   1. Write a class extending ProviderBase and implementing VTUProviderInterface.
 *   2. Add it here with its ProviderRegistryEntry so the admin UI can list it.
 */
interface RegistryEntry {
  cls: ProviderConstructor;
  meta: ProviderRegistryEntry;
}

// Import implementations
import { AdexProvider } from './implementations/AdexProvider';
import { VtpassProvider } from './implementations/VtpassProvider';
import { SandboxProvider } from './implementations/sandbox';

const REGISTRY: Record<string, RegistryEntry> = {
  adex: {
    cls: AdexProvider,
    meta: {
      code: 'adex',
      label: 'Adex VTU',
      authMethod: 'token_login',
      credentialHints: {
        username: 'Your Adex username / email',
        password: 'Your Adex password',
      },
      defaultServices: ['airtime', 'data', 'cable', 'electricity', 'exam', 'sms'],
      docsUrl: 'https://adexvtu.com/api-docs',
    },
  },
  vtpass: {
    cls: VtpassProvider,
    meta: {
      code: 'vtpass',
      label: 'VTPass',
      authMethod: 'api_key',
      credentialHints: {
        apiKey: 'sk_live_...',
        publicKey: 'pk_live_...',
        secretKey: 'sk_live_secret_...',
      },
      defaultServices: ['airtime', 'data', 'cable', 'electricity', 'exam'],
      docsUrl: 'https://vtpass.com/documentation/api/',
    },
  },
  sandbox: {
    cls: SandboxProvider,
    meta: {
      code: 'sandbox',
      label: 'Sandbox (Testing)',
      authMethod: 'api_key',
      credentialHints: {
        apiKey: 'any-value-works',
      },
      defaultServices: ['airtime', 'data', 'cable', 'electricity', 'exam', 'sms'],
    },
  },
  // Add more providers here:
  // bilal: { cls: BilalProvider, meta: { ... } },
  // ogdams: { cls: OgdamsProvider, meta: { ... } },
};

export class ProviderFactory {
  /**
   * Instantiate the correct provider class for a given DB config.
   * If USE_SANDBOX=true, every provider resolves to the sandbox stub.
   */
  static make(config: ProviderConfig): VTUProviderInterface {
    const useSandbox = process.env.USE_SANDBOX === 'true';
    const key = useSandbox ? 'sandbox' : config.code;

    const entry = REGISTRY[key];
    if (!entry) {
      throw new Error(
        `ProviderFactory: no implementation registered for code "${config.code}". ` +
        `Available codes: ${Object.keys(REGISTRY).join(', ')}`
      );
    }

    return new entry.cls(config);
  }

  /**
   * Returns UI metadata for all registered providers.
   * Used by the admin "Add provider" form to populate the code dropdown
   * and conditionally show the right credential fields.
   */
  static getRegistry(): ProviderRegistryEntry[] {
    return Object.values(REGISTRY)
      .map(e => e.meta)
      .filter(m => m.code !== 'sandbox' || process.env.NODE_ENV !== 'production');
  }

  /** Returns metadata for a specific provider code. */
  static getMeta(code: string): ProviderRegistryEntry | null {
    return REGISTRY[code]?.meta ?? null;
  }

  /** Allows registering providers from outside this module (e.g. tests). */
  static register(code: string, cls: ProviderConstructor, meta: ProviderRegistryEntry): void {
    REGISTRY[code] = { cls, meta };
  }

  static isRegistered(code: string): boolean {
    return code in REGISTRY;
  }
}