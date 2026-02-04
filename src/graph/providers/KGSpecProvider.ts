/**
 * KGSpec Provider
 *
 * Deterministic provider for KGSpec input.
 * Wraps existing toTopologyFromKGSpec with normalization.
 */

import type { KGSpec } from '../kgSpec';
import type { TopologyProvider } from './providerTypes';
import { toTopologyFromKGSpec } from '../kgSpecLoader';
import { hashObject } from './hashUtils';

/**
 * KGSpec Provider Options
 */
export interface KGSpecProviderOptions {
    /** Whether to sort nodes/links by ID (default true) */
    sortById?: boolean;
    /** Whether to deduplicate links (default true) */
    deduplicateLinks?: boolean;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: KGSpecProviderOptions = {
    sortById: true,
    deduplicateLinks: true
};

/**
 * KGSpec Topology Provider
 *
 * Produces deterministic topology from KGSpec input.
 */
export const KGSpecProvider: TopologyProvider<KGSpec> = {
    name: 'kgSpec',

    buildSnapshot(spec: KGSpec) {
        // Use existing converter
        let topology = toTopologyFromKGSpec(spec);

        // Normalize: sort by ID
        const opts = DEFAULT_OPTIONS;
        if (opts.sortById) {
            topology.nodes.sort((a, b) => a.id.localeCompare(b.id));
            topology.links.sort((a, b) => {
                const aKey = `${a.from}->${a.to}`;
                const bKey = `${b.from}->${b.to}`;
                return aKey.localeCompare(bKey);
            });
        }

        return {
            nodes: topology.nodes,
            directedLinks: topology.links,
            meta: {
                provider: 'kgSpec',
                docId: spec.docId,
                inputHash: hashObject(spec)
            }
        };
    },

    hashInput(spec: KGSpec): string {
        return hashObject(spec);
    }
};
