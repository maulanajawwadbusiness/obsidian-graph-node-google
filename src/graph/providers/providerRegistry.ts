/**
 * Provider Registry
 *
 * Central registry of topology providers.
 */

import type { TopologyProvider, ProviderRegistryEntry } from './providerTypes';
import { KGSpecProvider } from './KGSpecProvider';
import { ManualMutationProvider } from './ManualMutationProvider';

/**
 * Global provider registry
 */
const providerRegistry = new Map<string, ProviderRegistryEntry>();

/**
 * Register a topology provider.
 *
 * @param entry Provider registry entry
 */
export function registerProvider(entry: ProviderRegistryEntry): void {
    const { provider } = entry;
    if (providerRegistry.has(provider.name)) {
        if (import.meta.env.DEV) {
            console.warn(`[ProviderRegistry] Provider '${provider.name}' already registered - overwriting`);
        }
    }
    providerRegistry.set(provider.name, entry);
    if (import.meta.env.DEV) {
        console.log(`[ProviderRegistry] Registered provider: ${provider.name}`);
    }
}

/**
 * Get a registered provider by name.
 *
 * @param name Provider name
 * @returns Provider or undefined
 */
export function getProvider(name: string): TopologyProvider | undefined {
    const entry = providerRegistry.get(name);
    return entry?.provider;
}

/**
 * List all registered provider names.
 *
 * @returns Array of provider names
 */
export function listProviders(): string[] {
    return Array.from(providerRegistry.keys()).sort();
}

/**
 * Initialize default providers.
 * Called during module initialization.
 */
export function initializeDefaultProviders(): void {
    registerProvider({
        provider: KGSpecProvider,
        schemaVersion: 'kg/1',
        description: 'KGSpec topology provider (deterministic)'
    });
    registerProvider({
        provider: ManualMutationProvider,
        description: 'Manual mutation provider (addLink/removeLink)'
    });
}

// Auto-initialize on import
initializeDefaultProviders();

if (import.meta.env.DEV) {
    console.log(`[ProviderRegistry] Initialized with ${providerRegistry.size} providers:`, listProviders());
}
