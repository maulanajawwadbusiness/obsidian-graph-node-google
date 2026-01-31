import type { PhysicsEngine } from '../../engine';
import type { PhysicsNode } from '../../types';
import type { MotionPolicy } from '../motionPolicy';
import { getPassStats, type DebugStats } from '../stats';

/**
 * LOCAL PHASE DIFFUSION (Shape Memory Eraser)
 * 
 * Breaks residual oscillation phase alignment in dense cores.
 * Second layer of velocity decorrelation (after angular decoherence).
 * 
 * Purpose: Nodes in dense cores can preserve synchronized oscillation phase,
 * causing them to form coherent rings/loops instead of diffusing as clouds.
 * This pass breaks that phase synchronization.
 * 
 * Properties:
 * - Preserves |v| (energy-neutral)
 * - Different hash seed than angular decoherence
 * - Smaller angles (0.3°-0.8° vs 0.5°-1.5°)
 * - Deterministic
 * - Self-disabling
 */
export const applyLocalPhaseDiffusion = (
    _engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    policy: MotionPolicy,
    stats: DebugStats
) => {
    const phaseStrength = policy.earlyExpansion;
    if (phaseStrength <= 0.01) return;

    const passStats = getPassStats(stats, 'PhaseDiffusion');
    const affected = new Set<string>();

    const densityRadius = 30;
    const densityThreshold = 4;
    const minSpeed = 0.1;

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

    // Apply phase diffusion (second layer of decorrelation)
    for (const node of nodeList) {
        if (node.isFixed) continue;

        const density = localDensity.get(node.id) || 0;
        if (density < densityThreshold) continue;

        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (speed < minSpeed) continue;

        // Different hash seed than angular decoherence
        // This ensures independent phase variation
        let hash = 0;
        const seed = 7919;  // Prime number seed for phase diffusion
        for (let i = 0; i < node.id.length; i++) {
            hash = ((hash << 5) - hash) + node.id.charCodeAt(i) * seed;
            hash |= 0;
        }

        // Smaller angles than angular decoherence: 0.3° to 0.8°
        const normalizedHash = (Math.abs(hash) % 1000) / 1000;  // 0-1
        const minAngle = 0.3 * Math.PI / 180;  // 0.3 degrees
        const maxAngle = 0.8 * Math.PI / 180;  // 0.8 degrees
        const angle = (minAngle + normalizedHash * (maxAngle - minAngle)) * phaseStrength;

        // Alternate sign based on different hash parity
        const angleSign = ((hash >> 1) % 2 === 0) ? 1 : -1;
        const phaseOffset = angle * angleSign;

        // Rotate velocity vector (phase diffusion)
        const cos = Math.cos(phaseOffset);
        const sin = Math.sin(phaseOffset);

        const beforeVx = node.vx;
        const beforeVy = node.vy;

        node.vx = beforeVx * cos - beforeVy * sin;
        node.vy = beforeVx * sin + beforeVy * cos;

        // Verify magnitude preservation
        const newSpeed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        const speedError = Math.abs(newSpeed - speed);
        if (speedError > 0.001) {
            node.vx = (node.vx / newSpeed) * speed;
            node.vy = (node.vy / newSpeed) * speed;
        }

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
        console.log(`[PhaseDiffusion] desynchronized: ${affected.size} nodes (shape memory eraser)`);
    }
};
