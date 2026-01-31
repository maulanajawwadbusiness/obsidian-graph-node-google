import type { PhysicsEngine } from '../../engine';
import type { PhysicsNode } from '../../types';
import type { MotionPolicy } from '../motionPolicy';
import { getPassStats, type DebugStats } from '../stats';

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
 * - Early expansion (policy-ramped)
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
    policy: MotionPolicy,
    stats: DebugStats
) => {
    const shearStrength = policy.earlyExpansion;
    if (shearStrength <= 0.01) return;

    const passStats = getPassStats(stats, 'EdgeShearEscape');
    let unlockedPairs = 0;

    const densityRadius = 30;
    const densityThreshold = 4;
    const restEps = 5.0;      // Edge must be within 5px of rest length
    const velEps = 0.3;       // Relative velocity threshold
    const forceEps = 0.8;     // Force magnitude threshold
    const baseSlip = 0.03 * shearStrength;    // Base shear magnitude (px/frame)

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

        // FIX: Cooldown Check
        const nowMs = engine.lifecycle * 1000;
        if (nowMs - (source.lastMicroSlipMs || 0) < 1000) continue;
        if (nowMs - (target.lastMicroSlipMs || 0) < 1000) continue;

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
        let shearSign = (pairHash % 2 === 0) ? 1 : -1;

        // FIX: Constraint Awareness
        // Ensure shear doesn't fight PBD corrections combined
        const sx = perpX * slip * shearSign;
        const sy = perpY * slip * shearSign;

        // Source gets (+sx, +sy), Target gets (-sx, -sy)
        const dotSrc = sx * (source.lastCorrectionX || 0) + sy * (source.lastCorrectionY || 0);
        const dotTgt = (-sx) * (target.lastCorrectionX || 0) + (-sy) * (target.lastCorrectionY || 0);

        if ((dotSrc + dotTgt) < -0.0001) {
            shearSign *= -1; // Flip to assist
            if (stats.injectors) stats.injectors.escapeLoopSuspectCount++;
        }

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

        source.lastMicroSlipMs = nowMs;
        target.lastMicroSlipMs = nowMs;
        if (stats.injectors) {
            stats.injectors.microSlipFires += 2;
            stats.injectors.escapeFires += 2;
        }
    }

    passStats.nodes += unlockedPairs * 2;

    // DEBUG
    if (unlockedPairs > 0) {
        console.log(`[EdgeShearEscape] unlocked: ${unlockedPairs} pairs (perpendicular shear)`);
    }
};
