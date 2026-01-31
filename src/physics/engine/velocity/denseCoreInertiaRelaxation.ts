import type { PhysicsEngine } from '../../engine';
import type { PhysicsNode } from '../../types';
import type { MotionPolicy } from '../motionPolicy';
import { getPassStats, type DebugStats } from '../stats';

/**
 * DENSE-CORE INERTIA RELAXATION (Momentum Memory Eraser)
 * 
 * Blends velocity toward neighborhood flow for jammed nodes.
 * Removes directional momentum memory that keeps nodes returning to origin.
 * 
 * This is NOT damping:
 * - Does not kill energy
 * - Preserves velocity magnitude (approximately)
 * - Only removes directional memory
 * 
 * Purpose: Last ~10% of stuck nodes carry early-phase momentum coherence
 * that re-projects them back to their original position. This pass lets
 * them "forget" that history and re-phase with the local cloud flow.
 * 
 * Properties:
 * - Blends toward avgNeighborVelocity
 * - Stuckness-gated (low speed + low force)
 * - Density-gated
 * - Energy-gated
 * - Magnitude-preserving
 * - Deterministic
 * - Self-disabling
 */
export const applyDenseCoreInertiaRelaxation = (
    _engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    policy: MotionPolicy,
    stats: DebugStats
) => {
    const relaxGate = policy.earlyExpansion;
    if (relaxGate <= 0.01) return;

    const passStats = getPassStats(stats, 'InertiaRelax');
    const affected = new Set<string>();

    const densityRadius = 30;
    const densityThreshold = 4;
    const velEps = 0.5;      // Speed threshold for stuckness
    const forceEps = 0.8;    // Force threshold for stuckness
    const relaxStrength = 0.12;  // How much to blend toward neighbor flow (0.05-0.15)

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

    // Apply inertia relaxation
    for (const node of nodeList) {
        if (node.isFixed) continue;

        const density = localDensity.get(node.id) || 0;
        if (density < densityThreshold) continue;

        // Compute stuckness (how "jammed" is this node?)
        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        const forceMag = Math.sqrt(node.fx * node.fx + node.fy * node.fy);

        const speedStuck = Math.max(0, Math.min(1, 1 - speed / velEps));
        const forceStuck = Math.max(0, Math.min(1, 1 - forceMag / forceEps));
        const stuckness = speedStuck * forceStuck;

        if (stuckness < 0.1) continue;  // Not stuck enough

        // Compute average neighbor velocity (local flow)
        let avgVx = 0, avgVy = 0;
        let neighborCount = 0;

        for (const other of nodeList) {
            if (other.id === node.id) continue;
            const dx = other.x - node.x;
            const dy = other.y - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < densityRadius) {
                avgVx += other.vx;
                avgVy += other.vy;
                neighborCount++;
            }
        }

        if (neighborCount === 0) continue;

        avgVx /= neighborCount;
        avgVy /= neighborCount;

        // Blend velocity toward neighborhood flow
        const effectiveRelax = relaxStrength * stuckness * relaxGate;

        const beforeVx = node.vx;
        const beforeVy = node.vy;
        const beforeSpeed = speed;

        // Lerp toward neighbor average
        node.vx = beforeVx * (1 - effectiveRelax) + avgVx * effectiveRelax;
        node.vy = beforeVy * (1 - effectiveRelax) + avgVy * effectiveRelax;

        // Magnitude preservation: re-scale to original speed
        // This ensures we're only changing direction, not energy
        const newSpeed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (newSpeed > 0.01 && beforeSpeed > 0.01) {
            node.vx = (node.vx / newSpeed) * beforeSpeed;
            node.vy = (node.vy / newSpeed) * beforeSpeed;
        }

        const dvx = node.vx - beforeVx;
        const dvy = node.vy - beforeVy;
        const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
        if (deltaMag > 0.001) {
            passStats.velocity += deltaMag;
            affected.add(node.id);
        }
    }

    passStats.nodes += affected.size;

    // DEBUG
    if (affected.size > 0) {
        console.log(`[InertiaRelax] affected: ${affected.size} nodes (momentum memory erased)`);
    }
};
