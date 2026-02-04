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

        // STEP7-RUN11: Strengthen normalization
        const opts = DEFAULT_OPTIONS;

        // 1. Normalize nodes (trim labels, fallback to ID)
        topology.nodes = topology.nodes.map(node => ({
            ...node,
            label: node.label?.trim() || node.id
        }));

        // 2. Normalize links (trim kind, default to 'relates')
        topology.links = topology.links.map(link => ({
            ...link,
            kind: link.kind?.trim() || 'relates'
        }));

        // 3. Deduplicate nodes by ID (keep first occurrence)
        const seenNodeIds = new Set<string>();
        topology.nodes = topology.nodes.filter(node => {
            if (seenNodeIds.has(node.id)) {
                if (import.meta.env.DEV) {
                    console.warn(`[KGSpecProvider] Dedup: duplicate node ID ${node.id}`);
                }
                return false;
            }
            seenNodeIds.add(node.id);
            return true;
        });

        // 4. Deduplicate links by (from, to, kind) tuple (keep first)
        const seenLinkKeys = new Set<string>();
        topology.links = topology.links.filter(link => {
            const key = `${link.from}:${link.to}:${link.kind}`;
            if (seenLinkKeys.has(key)) {
                if (import.meta.env.DEV) {
                    console.warn(`[KGSpecProvider] Dedup: duplicate link ${key}`);
                }
                return false;
            }
            seenLinkKeys.add(key);
            return true;
        });

        // 5. Sort by ID (canonical ordering)
        if (opts.sortById) {
            topology.nodes.sort((a, b) => a.id.localeCompare(b.id));
            topology.links.sort((a, b) => {
                // Primary: from, Secondary: to, Tertiary: kind
                if (a.from !== b.from) return a.from.localeCompare(b.from);
                if (a.to !== b.to) return a.to.localeCompare(b.to);
                return (a.kind || 'relates').localeCompare(b.kind || 'relates');
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
