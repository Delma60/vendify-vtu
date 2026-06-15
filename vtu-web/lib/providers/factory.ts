// vtu-web/lib/providers/factory.ts
// AGENTS.md RULES: #13 (config from Firestore), #14 (runtime config)

import type { VTUProviderInterface } from './interface';
import type { ProviderConfig } from '@/types/provider';
// import { VtpassProvider } from './implementations/vtpass';
// import { SmePlugProvider } from './implementations/smeplug';
// import { SandboxProvider } from './implementations/sandbox';

type ProviderConstructor = new (config: ProviderConfig) => VTUProviderInterface;

/**
 * Registry of implementation classes keyed by `ProviderConfig.code`.
 * To add a new vendor: write a class implementing VTUProviderInterface
 * (extend ProviderBase) and register it here.
 */
const REGISTRY: Record<string, ProviderConstructor> = {
//   vtpass: VtpassProvider,
//   sme_plug: SmePlugProvider,
//   sandbox: SandboxProvider,
  // bilal: BilalProvider,
  // ogdams: OgdamsProvider,
  // adex: AdexProvider,
};

export class ProviderFactory {
  /**
   * Instantiate the correct provider class for a given DB config.
   * If USE_SANDBOX=true, every provider resolves to the sandbox stub —
   * mirrors VendorFactory's $useSandbox short-circuit.
   */
  static make(config: ProviderConfig): VTUProviderInterface {
    const useSandbox = process.env.USE_SANDBOX === 'true';
    const key = useSandbox ? 'sandbox' : config.code;

    const ProviderClass = REGISTRY[key];
    if (!ProviderClass) {
      throw new Error(`ProviderFactory: no implementation registered for code "${config.code}"`);
    }

    return new ProviderClass(config);
  }

  /** Allows registering providers from outside this module (e.g. tests). */
  static register(code: string, providerClass: ProviderConstructor): void {
    REGISTRY[code] = providerClass;
  }

  static isRegistered(code: string): boolean {
    return code in REGISTRY;
  }
}