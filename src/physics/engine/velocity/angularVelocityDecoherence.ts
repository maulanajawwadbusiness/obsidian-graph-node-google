import type { PhysicsEngine } from '../../engine';
import type { PhysicsNode } from '../../types';
import { getPassStats, type DebugStats } from '../stats';

/**
 * ANGULAR VELOCITY DECOHERENCE (Micro-Vorticity Seeding)
 * 
 * Breaks velocity orientation correlation in dense cores.
 * Rotates each node's velocity vector by a tiny deterministic angle.
 * 
 * Properties:
 * - Preserves |v| (energy-neutral)
 * - No net momentum injection
 * - Deterministic (hash-based)
 * - Solver-level only
 * - Self-disabling as density drops
 * 
 * Result: Dense core shears and swirls instead of drifting as a unit.
 */
export const applyAngularVelocityDecoherence = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    energy: number,
    stats: DebugStats
) => {
    // Only during early expansion
    if (energy <= 0.85) return;

    const passStats = getPassStats(stats, 'AngularDecoherence');
    const affected = new Set<string>();

    const densityRadius = 30;
    const densityThreshold = 4;
    const minSpeed = 0.1;  // Skip near-stationary nodes

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

    // Apply angular decoherence
    for (const node of nodeList) {
        if (node.isFixed) continue;

        const density = localDensity.get(node.id) || 0;
        if (density < densityThreshold) continue;

        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (speed < minSpeed) continue;

        // Hash-based angular offset (deterministic)
        let hash = 0;
        for (let i = 0; i < node.id.length; i++) {
            hash = ((hash << 5) - hash) + node.id.charCodeAt(i);
            hash |= 0;
        }

        // Map hash to angle: 0.5° to 1.5° (0.0087 to 0.0262 radians)
        const normalizedHash = (Math.abs(hash) % 1000) / 1000;  // 0-1
        const minAngle = 0.5 * Math.PI / 180;  // 0.5 degrees
        const maxAngle = 1.5 * Math.PI / 180;  // 1.5 degrees
        const angle = minAngle + normalizedHash * (maxAngle - minAngle);

        // Alternate sign based on hash parity (half CW, half CCW)
        const angleSign = (hash % 2 === 0) ? 1 : -1;
        const rotationAngle = angle * angleSign;

        // Rotate velocity vector (preserve magnitude)
        const cos = Math.cos(rotationAngle);
        const sin = Math.sin(rotationAngle);

        const beforeVx = node.vx;
        const beforeVy = node.vy;

        node.vx = beforeVx * cos - beforeVy * sin;
        node.vy = beforeVx * sin + beforeVy * cos;

        // Verify magnitude preservation (should be exact)
        const newSpeed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        const speedError = Math.abs(newSpeed - speed);
        if (speedError > 0.001) {
            // Renormalize to be safe (should never happen with exact rotation)
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
        console.log(`[AngularDecoherence] rotated: ${affected.size} nodes (micro-vorticity seeding)`);
    }
};
