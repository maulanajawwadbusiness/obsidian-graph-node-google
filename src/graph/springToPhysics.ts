/**
 * Spring-to-Physics Link Conversion
 * 
 * Converts SpringEdge (topology layer) to PhysicsLink (engine layer).
 */

import type { SpringEdge } from './topologyTypes';
import type { PhysicsLink } from '../physics/types';

/**
 * Convert SpringEdge to PhysicsLink for engine consumption.
 * RUN 9: Now uses restLen from SpringEdge if provided.
 */
export function springEdgeToPhysicsLink(edge: SpringEdge): PhysicsLink {
    return {
        source: edge.a,
        target: edge.b,
        length: edge.restLen, // Use policy-computed rest length
        strength: edge.strength,
        // Preserve metadata for traceability
        lengthBias: 1.0,
        stiffnessBias: edge.strength || 1.0
    };
}

/**
 * Batch convert spring edges to physics links.
 */
export function springEdgesToPhysicsLinks(edges: SpringEdge[]): PhysicsLink[] {
    return edges.map(springEdgeToPhysicsLink);
}
