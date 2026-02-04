/**
 * Topology Spring Recomputation
 * 
 * STEP3-RUN3: Helper to derive undirected springs from directed knowledge links.
 * This is the seam that separates knowledge (directed) from physics (undirected).
 */

import type { Topology } from './topologyTypes';
import { deriveSpringEdges } from './springDerivation';
import type { ForceConfig } from '../physics/types';

/**
 * Recompute undirected physics springs from current directed knowledge links.
 * 
 * This is the authoritative conversion point:
 * - Input: topology.links (directed knowledge)
 * - Output: topology.springs (undirected physics, deduplicated)
 * 
 * Called after topology mutations to keep springs in sync.
 * 
 * @param topology Topology with links to convert
 * @param config Physics configuration for rest length policy
 * @returns Updated topology with springs array populated
 */
export function recomputeSprings(topology: Topology, config?: ForceConfig): Topology {
    // Derive springs from knowledge links (already handles deduplication)
    const springs = deriveSpringEdges(topology, config);

    // STEP3-RUN5-FIX3: Dev-only invariant check
    if (import.meta.env.DEV && topology.springs && topology.springs.length > 0) {
        const freshCount = springs.length;
        const existingCount = topology.springs.length;
        if (freshCount !== existingCount) {
            console.warn(`[TopologySpringRecompute] ⚠ Spring count mismatch! Fresh=${freshCount}, Existing=${existingCount}`);
            console.warn(`[TopologySpringRecompute] Springs were stale - replacing with fresh derivation`);
        }
    }

    // Return updated topology with springs
    return {
        ...topology,
        springs
    };
}
