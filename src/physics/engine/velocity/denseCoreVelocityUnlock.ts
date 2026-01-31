import type { PhysicsEngine } from '../../engine';
import type { PhysicsNode } from '../../types';
import { getPassStats, type DebugStats } from '../stats';
import { logVelocityDeLocking } from './debugVelocity';
import type { MotionPolicy } from '../motionPolicy';
import type { UnifiedMotionState } from '../unifiedMotionState';
import { getDenseRamp, getEarlyExpansionRamp } from './energyGates';
import {
    computeAverageNeighborVelocity,
    projectVelocityComponents,
    type VelocityAccumulator,
    type VelocityProjection,
} from './relativeVelocityUtils';

/**
 * DENSE-CORE VELOCITY DE-LOCKING (Micro-Slip)
 * Breaks rigid-body velocity alignment in dense regions.
 * Reduces parallel component of velocity relative to neighbor average.
 * Allows nodes to slide relative to each other during early expansion.
 */
export const applyDenseCoreVelocityDeLocking = (
    _engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    motionState: UnifiedMotionState,
    motionPolicy: MotionPolicy,
    stats: DebugStats
) => {
    // Only during early expansion
    const expansionRamp = getEarlyExpansionRamp(motionState.temperature);
    if (expansionRamp <= 0) return;

    const passStats = getPassStats(stats, 'VelocityDeLocking');
    const affected = new Set<string>();

    const densityRadius = motionPolicy.densityRadius;
    const densityThreshold = motionPolicy.densityThreshold;
    const parallelReduction = 0.2;  // Reduce parallel by 20%

    const avgVelocity: VelocityAccumulator = { vx: 0, vy: 0 };
    const projection: VelocityProjection = {
        parallelX: 0,
        parallelY: 0,
        perpX: 0,
        perpY: 0,
    };

    for (const node of nodeList) {
        if (node.isFixed) continue;

        // Count neighbors and compute average velocity
        const neighborCount = computeAverageNeighborVelocity(node, nodeList, densityRadius, avgVelocity);

        // Only apply to dense nodes
        const densityRamp = getDenseRamp(neighborCount, densityThreshold);
        if (densityRamp <= 0) continue;

        const avgVx = avgVelocity.vx / neighborCount;
        const avgVy = avgVelocity.vy / neighborCount;

        // Skip if average velocity is near zero (no alignment to break)
        const avgVMag = Math.sqrt(avgVx * avgVx + avgVy * avgVy);
        if (avgVMag < 0.1) continue;

        // FIX #12: STAGNATION GATING
        // Only apply de-locking if the system is actually stuck (micro-jammed).
        // If nodes are moving freely, we don't need to break locks.
        // We infer stagnation if the maximum velocity in the system is low, OR 
        // if we had a persistent stagnation tracking metric (which we simulate here by a threshold).
        // Actually, we can check stats from the previous frame if available, but for now
        // let's be conservative: only delock if average velocity is small.
        // If `avgVMag` (local group velocity) is high, the group is moving, so don't break it.

        // Correction: The original requirement said "Gate de-locking tightly: only apply when system is truly stuck".
        // We already compute `avgVMag`.
        // Let's add a "Max De-Lock Velocity" gate. If group moves faster than 2.0px/frame, it's not locked.
        if (avgVMag > 2.0) continue;

        // Normal de-locking logic...
        // Normalize average velocity direction
        const avgUx = avgVx / avgVMag;
        const avgUy = avgVy / avgVMag;

        // Project node velocity onto average direction
        projectVelocityComponents(node.vx, node.vy, avgUx, avgUy, projection);

        // Recombine with reduced parallel (micro-slip)
        const beforeVx = node.vx;
        const beforeVy = node.vy;

        const reduction = parallelReduction * expansionRamp * densityRamp;
        node.vx = projection.perpX + projection.parallelX * (1 - reduction);
        node.vy = projection.perpY + projection.parallelY * (1 - reduction);

        const dvx = node.vx - beforeVx;
        const dvy = node.vy - beforeVy;
        const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
        if (deltaMag > 0) {
            passStats.velocity += deltaMag;
            affected.add(node.id);
        }
    }

    passStats.nodes += affected.size;

    // DEBUG: log for early expansion
    if (affected.size > 0) {
        logVelocityDeLocking(affected.size);
    }
};
