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
    // FIX: Gate by settle confidence (Continuous Law)
    const settleGate = Math.pow(1 - (policy.settleScalar || 0), 2);
    const frictionStrength = policy.diffusion * settleGate;

    if (frictionStrength <= 0.001) return;
    if (engine.draggedNodeId) return;

    // FIX: Cooldown & Stuckness
    const STUCK_THRESH = 0.5;
    const COOLDOWN_SEC = 1.0;
    const nowSec = engine.lifecycle;

    const passStats = getPassStats(stats, 'StaticFrictionBypass');
    const affected = new Set<string>();

    const densityRadius = 30;
    const densityThreshold = 4;
    const microSlip = 0.01 * frictionStrength;

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
        // FIX: Replaced with STUCK SCORE + COOLDOWN
        const srcStuck = source.stuckScore || 0;
        const tgtStuck = target.stuckScore || 0;

        // 1. Must be stuck (Pressure + Low Speed)
        if (srcStuck < STUCK_THRESH && tgtStuck < STUCK_THRESH) continue;

        // 2. Cooldown (Heartbeat Protection)
        const nowMs = nowSec * 1000;
        if ((nowMs - (source.lastMicroSlipMs || 0)) < COOLDOWN_SEC * 1000) continue;
        if ((nowMs - (target.lastMicroSlipMs || 0)) < COOLDOWN_SEC * 1000) continue;

        // 3. Keep Low RelVel check as safety?
        // If stuckScore is high, speed MUST be low (by definition of stuckScore).
        // So explicit relVel check is redundant but harmless.
        if (relVMag >= 0.1) continue; // Safety guard against high-speed firing

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
        if (srcDelta > 0) {
            affected.add(source.id);
            source.lastMicroSlipMs = nowMs;
        }
        if (tgtDelta > 0) {
            affected.add(target.id);
            target.lastMicroSlipMs = nowMs;
        }
        if (srcDelta > 0 || tgtDelta > 0) {
            if (stats.injectors) stats.injectors.microSlipFires += (srcDelta > 0 ? 1 : 0) + (tgtDelta > 0 ? 1 : 0);
        }
        passStats.velocity += srcDelta + tgtDelta;
    }

    passStats.nodes += affected.size;

    // DEBUG
    if (affected.size > 0) {
        if (stats.injectors) {
            stats.injectors.microSlipCount += affected.size;
            stats.injectors.microSlipDv += passStats.velocity;
            stats.injectors.lastInjector = 'FrictionBypass';
        }
    }
    logStaticFrictionBypass(affected.size);
};
