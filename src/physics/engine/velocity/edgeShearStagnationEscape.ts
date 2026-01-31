import type { PhysicsEngine } from '../../engine';
import type { PhysicsNode } from '../../types';
import { getPassStats, type DebugStats } from '../stats';
import type { MotionPolicy } from '../motionPolicy';

/**
 * EDGE SHEAR STAGNATION ESCAPE (Null-Gradient Unlock)
 * 
 * Breaks jammed edge locks by applying perpendicular shear on rest-satisfied springs.
 * Pairwise symmetric: node gets +perp, neighbor gets -perp (zero net momentum).
 * 
 * Purpose: The last ~10% of stuck nodes are "jammed pairs" where both nodes are
 * at rest relative to each other on a near-perfect-length spring. The only way
 * out is sideways slip, not drift along the edge.
 * 
 * Trigger conditions:
 * - Dense core (localDensity >= threshold)
 * - Early expansion (energy > 0.85)
 * - Edge near rest length (|dist - restLength| < restEps)
 * - Both nodes have low relative velocity
 * - Both nodes have low net force
 * 
 * Properties:
 * - Perpendicular only (pure shear, no radial push)
 * - Pairwise symmetric (zero net momentum)
 * - Deterministic (pair hash for sign)
 * - Stuckness-ramped magnitude
 * - Sub-pixel (~0.02-0.04 px/frame max)
 * - Self-disabling
 */
export const applyEdgeShearStagnationEscape = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    energy: number,
    motionPolicy: MotionPolicy,
    stats: DebugStats
) => {
    // Only during early expansion
    if (energy <= 0.85) return;

    const passStats = getPassStats(stats, 'EdgeShearEscape');
    let unlockedPairs = 0;

    const densityRadius = motionPolicy.densityRadius;
    const densityThreshold = motionPolicy.densityThreshold;
    const restEps = motionPolicy.restLengthEpsilon;         // Edge must be near rest length
    const velEps = motionPolicy.stuckSpeedEpsilon * 0.6;    // Relative velocity threshold
    const forceEps = motionPolicy.stuckForceEpsilon;        // Force magnitude threshold
    const baseSlip = motionPolicy.microSlip;                // Base shear magnitude

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

    // Track processed pairs to avoid double-processing
    const processedPairs = new Set<string>();

    // Process all links
    for (const link of engine.links) {
        const source = engine.nodes.get(link.source);
        const target = engine.nodes.get(link.target);
        if (!source || !target) continue;
        if (source.isFixed && target.isFixed) continue;

        // Canonical pair key
        const pairKey = source.id < target.id
            ? `${source.id}:${target.id}`
            : `${target.id}:${source.id}`;
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        // At least one node must be in dense region
        const srcDensity = localDensity.get(source.id) || 0;
        const tgtDensity = localDensity.get(target.id) || 0;
        if (srcDensity < densityThreshold && tgtDensity < densityThreshold) continue;

        // Compute edge geometry
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.1) continue;

        const restLength = link.length || engine.config.linkRestLength;
        const tension = Math.abs(dist - restLength);

        // Gate 1: Edge must be near rest length (most "satisfied")
        if (tension > restEps) continue;

        // Edge direction (unit vector)
        const edgeX = dx / dist;
        const edgeY = dy / dist;

        // Perpendicular direction (90° rotation)
        const perpX = -edgeY;
        const perpY = edgeX;

        // Compute relative velocity along edge and perpendicular
        const relVx = target.vx - source.vx;
        const relVy = target.vy - source.vy;
        const relVelAlongEdge = Math.abs(relVx * edgeX + relVy * edgeY);
        const relVelPerp = Math.abs(relVx * perpX + relVy * perpY);

        // Gate 2: Both relative velocity components must be small (truly jammed)
        if (relVelAlongEdge >= velEps || relVelPerp >= velEps) continue;

        // Gate 3: Both nodes have low net force (stagnant equilibrium)
        const srcForceMag = Math.sqrt(source.fx * source.fx + source.fy * source.fy);
        const tgtForceMag = Math.sqrt(target.fx * target.fx + target.fy * target.fy);
        if (srcForceMag >= forceEps && tgtForceMag >= forceEps) continue;

        // Compute stuckness factor (how stuck is this pair?)
        const srcSpeed = Math.sqrt(source.vx * source.vx + source.vy * source.vy);
        const tgtSpeed = Math.sqrt(target.vx * target.vx + target.vy * target.vy);
        const avgSpeed = (srcSpeed + tgtSpeed) / 2;
        const avgForce = (srcForceMag + tgtForceMag) / 2;

        const speedStuck = Math.max(0, Math.min(1, 1 - avgSpeed / velEps));
        const forceStuck = Math.max(0, Math.min(1, 1 - avgForce / forceEps));
        const stuckness = speedStuck * forceStuck;

        if (stuckness < 0.1) continue;  // Not stuck enough

        // Compute slip magnitude (ramped by stuckness)
        const slip = baseSlip * stuckness;

        // Deterministic sign from pair hash (not node hash)
        let pairHash = 0;
        for (let i = 0; i < pairKey.length; i++) {
            pairHash = ((pairHash << 5) - pairHash) + pairKey.charCodeAt(i);
            pairHash |= 0;
        }
        const shearSign = (pairHash % 2 === 0) ? 1 : -1;

        // Apply pairwise symmetric perpendicular shear
        // Source gets +perp, target gets -perp (or vice versa based on sign)
        if (!source.isFixed) {
            source.vx += perpX * slip * shearSign;
            source.vy += perpY * slip * shearSign;
        }
        if (!target.isFixed) {
            target.vx -= perpX * slip * shearSign;
            target.vy -= perpY * slip * shearSign;
        }

        passStats.velocity += slip * 2;  // Both nodes affected
        unlockedPairs++;
    }

    passStats.nodes += unlockedPairs * 2;

    // DEBUG
    if (unlockedPairs > 0) {
        console.log(`[EdgeShearEscape] unlocked: ${unlockedPairs} pairs (perpendicular shear)`);
    }
};
