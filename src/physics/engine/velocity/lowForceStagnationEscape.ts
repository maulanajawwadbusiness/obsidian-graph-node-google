import type { PhysicsEngine } from '../../engine';
import type { PhysicsNode } from '../../types';
import { getPassStats, type DebugStats } from '../stats';

/**
 * LOW-FORCE STAGNATION ESCAPE (Null-Gradient Perturbation)
 * 
 * Breaks rest-position preference in force-balanced dense cores.
 * When net force magnitude is below epsilon, applies tiny drift
 * toward least-tensioned neighbor (topology-derived direction).
 * 
 * Purpose: Nodes in symmetric spring configurations can reach equilibrium
 * with zero net force. This creates "comfortable" rest positions that
 * resist natural cloud diffusion. This pass breaks that stagnation.
 * 
 * Properties:
 * - Topology-derived direction (not global)
 * - Sub-pixel magnitude (~0.01-0.03 px/frame)
 * - Only when |force| < epsilon
 * - Density-gated
 * - Energy-gated
 * - Deterministic
 * - Pairwise drift (no net momentum)
 */
export const applyLowForceStagnationEscape = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    energy: number,
    stats: DebugStats
) => {
    // Only during early expansion
    if (energy <= 0.85) return;

    const passStats = getPassStats(stats, 'StagnationEscape');
    const affected = new Set<string>();

    const densityRadius = 30;
    const densityThreshold = 4;
    const forceEpsilon = 0.5;  // Low-force threshold
    const driftMagnitude = 0.02;  // Sub-pixel drift

    // Pre-compute local density
    const localDensity = new Map<string, number>();
    for (const node of nodeList) {
        let count = 0;
        for (const other of nodeList) {
            if (other.id === node.id) continue;
            const dx = other.x - node.x;
            const dy = other.y - node.y;
            if (Math.sqrt(dx * dx + dy * dy) < densityRadius) count++;
        }
        localDensity.set(node.id, count);
    }

    // Build adjacency for topology-derived direction
    const neighbors = new Map<string, string[]>();
    for (const node of nodeList) {
        neighbors.set(node.id, []);
    }
    for (const link of engine.links) {
        neighbors.get(link.source)?.push(link.target);
        neighbors.get(link.target)?.push(link.source);
    }

    // Apply stagnation escape
    for (const node of nodeList) {
        if (node.isFixed) continue;

        const density = localDensity.get(node.id) || 0;
        if (density < densityThreshold) continue;

        // Check if net force is below epsilon (stagnant)
        const forceMag = Math.sqrt(node.fx * node.fx + node.fy * node.fy);
        if (forceMag >= forceEpsilon) continue;

        // Get connected neighbors
        const nbIds = neighbors.get(node.id);
        if (!nbIds || nbIds.length === 0) continue;

        // Find least-tensioned neighbor (spring closest to rest length)
        let minTension = Infinity;
        let targetNb: PhysicsNode | null = null;

        for (const nbId of nbIds) {
            const nb = engine.nodes.get(nbId);
            if (!nb) continue;

            const dx = nb.x - node.x;
            const dy = nb.y - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Find rest length for this link
            let restLength = engine.config.linkRestLength;
            for (const link of engine.links) {
                if ((link.source === node.id && link.target === nbId) ||
                    (link.target === node.id && link.source === nbId)) {
                    restLength = link.restLength || engine.config.linkRestLength;
                    break;
                }
            }

            const tension = Math.abs(dist - restLength);
            if (tension < minTension) {
                minTension = tension;
                targetNb = nb;
            }
        }

        if (!targetNb) continue;

        // Compute drift direction (toward least-tensioned neighbor)
        const dx = targetNb.x - node.x;
        const dy = targetNb.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.1) continue;

        const nx = dx / dist;
        const ny = dy / dist;

        // Hash-based sign alternation (50% drift toward, 50% drift away)
        // This ensures pairwise balance over time
        let hash = 0;
        for (let i = 0; i < node.id.length; i++) {
            hash = ((hash << 5) - hash) + node.id.charCodeAt(i);
            hash |= 0;
        }
        const driftSign = (hash % 2 === 0) ? 1 : -1;

        // Apply sub-pixel drift to velocity
        const beforeVx = node.vx;
        const beforeVy = node.vy;

        node.vx += nx * driftMagnitude * driftSign;
        node.vy += ny * driftMagnitude * driftSign;

        const dvx = node.vx - beforeVx;
        const dvy = node.vy - beforeVy;
        const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
        if (deltaMag > 0) {
            passStats.velocity += deltaMag;
            affected.add(node.id);
        }
    }

    passStats.nodes += affected.size;

    // DEBUG
    if (affected.size > 0) {
        console.log(`[StagnationEscape] nudged: ${affected.size} nodes (null-gradient perturbation)`);
    }
};
