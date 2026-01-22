import type { PhysicsNode } from '../../types';
import { getPassStats, type DebugStats } from '../stats';
import { logVelocityDeLocking } from './debugVelocity';
import { isDense, isEarlyExpansion } from './energyGates';
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
    nodeList: PhysicsNode[],
    energy: number,
    stats: DebugStats
) => {
    // Only during early expansion
    if (!isEarlyExpansion(energy)) return;

    const passStats = getPassStats(stats, 'VelocityDeLocking');
    const affected = new Set<string>();

    const densityRadius = 30;  // Same as other dense-core detection
    const densityThreshold = 4;
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
        if (!isDense(neighborCount, densityThreshold)) continue;

        const avgVx = avgVelocity.vx / neighborCount;
        const avgVy = avgVelocity.vy / neighborCount;

        // Skip if average velocity is near zero (no alignment to break)
        const avgVMag = Math.sqrt(avgVx * avgVx + avgVy * avgVy);
        if (avgVMag < 0.1) continue;

        // Normalize average velocity direction
        const avgUx = avgVx / avgVMag;
        const avgUy = avgVy / avgVMag;

        // Project node velocity onto average direction
        projectVelocityComponents(node.vx, node.vy, avgUx, avgUy, projection);

        // Recombine with reduced parallel (micro-slip)
        const beforeVx = node.vx;
        const beforeVy = node.vy;

        node.vx = projection.perpX + projection.parallelX * (1 - parallelReduction);
        node.vy = projection.perpY + projection.parallelY * (1 - parallelReduction);

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
    logVelocityDeLocking(affected.size);
};
