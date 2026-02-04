/**
 * Rest Length Policy
 * 
 * Centralized computation of spring rest lengths from topology and physics state.
 * This is the ONLY place where rest lengths should be assigned to derived springs.
 */

import type { NodeId, Topology } from './topologyTypes';
import type { ForceConfig } from '../physics/types';

/**
 * Compute rest length for a spring edge between two nodes.
 * 
 * @param a First node ID
 * @param b Second node ID
 * @param topology The topology (for link metadata)
 * @param nodePositions Map of node IDs to current positions (optional)
 * @param config Physics configuration
 * @returns Rest length in pixels
 */
export function computeRestLen(
    a: NodeId,
    b: NodeId,
    topology: Topology,
    nodePositions: Map<string, { x: number; y: number }> | null,
    config: ForceConfig
): number {
    // Policy: Use targetSpacing as base rest length
    const baseRestLen = config.targetSpacing || 200;

    // Future: Could inspect topology.links to find corresponding directed link(s)
    // and apply metadata-based scaling (e.g., "strong" links = shorter rest length)

    // Future: Could use nodePositions to compute current distance
    // and apply spawn-time clamping (e.g., min 10px, max 1000px)

    // For now: simple uniform policy
    return baseRestLen;
}

/**
 * Batch compute rest lengths for all spring edges.
 * 
 * @param springEdges Array of spring edge pairs (a,b)
 * @param topology The topology
 * @param nodePositions Optional node positions
 * @param config Physics configuration
 * @returns Map of edge keys to rest lengths
 */
export function computeRestLengths(
    springEdges: Array<{ a: NodeId; b: NodeId }>,
    topology: Topology,
    nodePositions: Map<string, { x: number; y: number }> | null,
    config: ForceConfig,
    opts?: { silent?: boolean }
): Map<string, number> {
    const restLengths = new Map<string, number>();

    for (const edge of springEdges) {
        const key = `${edge.a}:${edge.b}`;
        const restLen = computeRestLen(edge.a, edge.b, topology, nodePositions, config);
        restLengths.set(key, restLen);
    }

    // RUN 9: Console proof (STEP3-RUN5-FIX8: Guard for empty springs)
    if (!opts?.silent && import.meta.env.DEV) {
        const lengths = Array.from(restLengths.values());
        if (lengths.length === 0) {
            console.log(`[Run9] Rest length policy: 0 edges (empty graph)`);
        } else {
            const min = Math.min(...lengths);
            const max = Math.max(...lengths);
            const avg = lengths.reduce((sum: number, len: number) => sum + len, 0) / lengths.length;
            console.log(`[Run9] Rest length policy: ${lengths.length} edges, min=${min.toFixed(1)}px, max=${max.toFixed(1)}px, avg=${avg.toFixed(1)}px`);
        }
    }

    return restLengths;
}
