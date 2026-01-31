import type { PhysicsEngine } from '../../engine';
import type { PhysicsNode } from '../../types';
import type { MotionPolicy } from '../motionPolicy';
import { getPassStats, type DebugStats } from '../stats';
import { getNowMs } from '../engineTime';

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
    policy: MotionPolicy,
    stats: DebugStats
) => {
    const driftStrength = policy.earlyExpansion;
    if (driftStrength <= 0.01) return;

    const passStats = getPassStats(stats, 'StagnationEscape');
    const affected = new Set<string>();

    const densityRadius = 30;
    const densityThreshold = 4;
    const forceEpsilon = 0.5;  // Low-force threshold
    const driftMagnitude = 0.02 * driftStrength;  // Sub-pixel drift

    // FIX D: Scale - Use Shared Cache
    // const localDensity = new Map<string, number>();
    const localDensity = engine.localDensityCache;

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
                    restLength = link.length || engine.config.linkRestLength;
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

        // FIX: Cooldown & Stuckness (Wall Clock)
        const nowMs = getNowMs();
        if ((node.stuckScore || 0) < 0.3) continue;
        if (nowMs - (node.lastMicroSlipMs || 0) < 1000) continue;

        // Hash-based sign alternation (50% drift toward, 50% drift away)
        // This ensures pairwise balance over time
        let hash = 0;
        for (let i = 0; i < node.id.length; i++) {
            hash = ((hash << 5) - hash) + node.id.charCodeAt(i);
            hash |= 0;
        }
        let driftSign = (hash % 2 === 0) ? 1 : -1;

        // FIX: Constraint Awareness (Don't fight PBD)
        const lcx = node.lastCorrectionX || 0;
        const lcy = node.lastCorrectionY || 0;
        const driftX = nx * driftMagnitude * driftSign;
        const driftY = ny * driftMagnitude * driftSign;

        // Dot product: > 0 means helping, < 0 means fighting
        const dot = driftX * lcx + driftY * lcy;
        if (dot < -0.0001) {
            // Fighting constraints! Flip direction to assist instead.
            driftSign *= -1;
            if (stats.injectors) stats.injectors.escapeLoopSuspectCount++;
        }

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
            affected.add(node.id);
            node.lastMicroSlipMs = nowMs;
            if (stats.injectors) {
                stats.injectors.microSlipFires++;
                stats.injectors.escapeFires++;
            }
        }
    }

    passStats.nodes += affected.size;

    // DEBUG
    if (affected.size > 0) {
        console.log(`[StagnationEscape] nudged: ${affected.size} nodes (null-gradient perturbation)`);
    }
};
