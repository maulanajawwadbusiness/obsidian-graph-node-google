/**
 * Spring-to-Physics Link Conversion
 *
 * Converts SpringEdge (topology layer) to PhysicsLink (engine layer).
 * STEP 8 - RUN 11: Preserves compliance field for XPBD mode.
 */

import type { SpringEdge } from './topologyTypes';
import type { PhysicsLink } from '../physics/types';

/**
 * Convert SpringEdge to PhysicsLink for engine consumption.
 * RUN 9: Now uses restLen from SpringEdge if provided.
 * STEP8-RUN11: Preserves compliance for XPBD mode (stored in metadata).
 */
export function springEdgeToPhysicsLink(edge: SpringEdge): PhysicsLink {
    const link: PhysicsLink = {
        source: edge.a,
        target: edge.b,
        length: edge.restLen, // Use policy-computed rest length
        strength: edge.stiffness, // Legacy mode: 0-1 range
        // Preserve metadata for traceability
        lengthBias: 1.0,
        stiffnessBias: edge.stiffness ?? 1.0
    };

    // STEP8-RUN11: Store compliance in metadata for XPBD mode
    // The XPBD engine reads this from a different path (config.xpbdLinkCompliance)
    // But we store it here for per-link compliance in the future
    if (edge.compliance !== undefined) {
        (link as any).compliance = edge.compliance;
    }

    return link;
}

/**
 * Batch convert spring edges to physics links.
 */
export function springEdgesToPhysicsLinks(edges: SpringEdge[]): PhysicsLink[] {
    return edges.map(springEdgeToPhysicsLink);
}
