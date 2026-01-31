import type { PhysicsEngine } from '../../engine';
import type { PhysicsNode } from '../../types';
import type { MotionPolicy } from '../motionPolicy';
import { getPassStats, type DebugStats } from '../stats';
import { logStaticFrictionBypass } from './debugVelocity';
import { isDense } from './energyGates';
import { computeRelativeVelocity } from './relativeVelocityUtils';

/**
 * STATIC FRICTION BYPASS (Zero-Velocity Unlock)
 * When connected dense node pairs have near-zero relative velocity,
 * inject tiny perpendicular shear to break static rest.
 * Pairwise symmetric - no net momentum injection.
 */
export const applyStaticFrictionBypass = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    policy: MotionPolicy,
    stats: DebugStats
) => {
    const frictionStrength = policy.microSlip;
    if (frictionStrength <= 0.01) return;

    // FIX 20: MICRO-NOISE MISGATING
    // Disable during interaction to prevent "fighting" the hand
    if (engine.draggedNodeId) return;

    const passStats = getPassStats(stats, 'StaticFrictionBypass');
    const affected = new Set<string>();

    const densityRadius = 30;
    const densityThreshold = 4;
    const relVelEpsilon = 0.05;  // FIX 20: Stricter activation (was 0.5)
    const microSlip = 0.01 * frictionStrength;      // FIX 20: Reduced amplitude (was 0.02)

    // Pre-compute local density for all nodes
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

    const relativeVelocity = { x: 0, y: 0 };

    // Process connected pairs (via links)
    for (const link of engine.links) {
        const source = engine.nodes.get(link.source);
        const target = engine.nodes.get(link.target);
        if (!source || !target) continue;
        if (source.isFixed && target.isFixed) continue;

        // Both nodes must be in dense region
        const sourceDensity = localDensity.get(source.id) || 0;
        const targetDensity = localDensity.get(target.id) || 0;
        if (!isDense(sourceDensity, densityThreshold) && !isDense(targetDensity, densityThreshold)) continue;

        // Compute relative velocity
        computeRelativeVelocity(source, target, relativeVelocity);
        const relVMag = Math.sqrt(relativeVelocity.x * relativeVelocity.x + relativeVelocity.y * relativeVelocity.y);

        // Only apply when relative velocity is near zero (static friction regime)
        if (relVMag >= relVelEpsilon) continue;

        // Compute spring direction
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.1) continue;  // Singularity guard

        // Spring unit vector
        const sx = dx / dist;
        const sy = dy / dist;

        // Perpendicular direction (deterministic based on node IDs)
        // Use node ID comparison to ensure consistent perpendicular direction
        const perpSign = source.id < target.id ? 1 : -1;
        const perpX = -sy * perpSign;
        const perpY = sx * perpSign;

        // Inject micro-slip: perpendicular shear
        // Pairwise symmetric: source gets +perp, target gets -perp
        const beforeSrcVx = source.vx;
        const beforeSrcVy = source.vy;
        const beforeTgtVx = target.vx;
        const beforeTgtVy = target.vy;

        if (!source.isFixed) {
            source.vx += perpX * microSlip;
            source.vy += perpY * microSlip;
        }
        if (!target.isFixed) {
            target.vx -= perpX * microSlip;
            target.vy -= perpY * microSlip;
        }

        // Track stats
        const srcDelta = Math.sqrt(
            (source.vx - beforeSrcVx) ** 2 + (source.vy - beforeSrcVy) ** 2
        );
        const tgtDelta = Math.sqrt(
            (target.vx - beforeTgtVx) ** 2 + (target.vy - beforeTgtVy) ** 2
        );
        if (srcDelta > 0) affected.add(source.id);
        if (tgtDelta > 0) affected.add(target.id);
        passStats.velocity += srcDelta + tgtDelta;
    }

    passStats.nodes += affected.size;

    // DEBUG
    logStaticFrictionBypass(affected.size);
};
