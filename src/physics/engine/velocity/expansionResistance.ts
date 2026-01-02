import type { PhysicsEngine } from '../../engine';
import type { PhysicsNode } from '../../types';
import { getPassStats, type DebugStats } from '../stats';

export const applyExpansionResistance = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    nodeDegree: Map<string, number>,
    energy: number,
    stats: DebugStats
) => {
    if (energy <= 0.7) return;

    const passStats = getPassStats(stats, 'ExpansionResistance');
    const affected = new Set<string>();
    const expResist = engine.config.expansionResistance;
    const trappedForceEpsilon = 1.0;
    const trappedVelocityEpsilon = 0.5;
    let hubSpeedBeforeTotal = 0;
    let hubSpeedAfterTotal = 0;
    let hubCount = 0;
    let trappedHubCount = 0;
    let skippedHubCount = 0;

    // DENSE-CORE DAMPING BYPASS
    // During early expansion, skip resistance for nodes in dense clusters
    const earlyExpansion = energy > 0.85;
    const denseRadius = engine.config.minNodeDistance * 0.8;
    const denseNodeSet = new Set<string>();

    if (earlyExpansion) {
        for (const node of nodeList) {
            let nearNeighborCount = 0;
            for (const other of nodeList) {
                if (other.id === node.id) continue;
                const dx = other.x - node.x;
                const dy = other.y - node.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < denseRadius) {
                    nearNeighborCount++;
                }
            }
            if (nearNeighborCount >= 3) {
                denseNodeSet.add(node.id);
            }
        }
    }

    for (const node of nodeList) {
        if (node.isFixed) continue;

        const degree = nodeDegree.get(node.id) || 0;
        if (degree <= 1) continue;  // Only affects multi-connected nodes

        // Skip resistance for dense nodes during early expansion
        if (earlyExpansion && denseNodeSet.has(node.id)) {
            continue; // 100% bypass
        }

        // Normalize degree: (degree-1)/4 → 0..1
        const degNorm = Math.min((degree - 1) / 4, 1);
        // Smoothstep for gradual ramp
        const resistance = degNorm * degNorm * (3 - 2 * degNorm);

        const beforeVx = node.vx;
        const beforeVy = node.vy;
        const speedBefore = Math.sqrt(beforeVx * beforeVx + beforeVy * beforeVy);

        // Apply as velocity damping (not position correction)
        let dampScale = 1;
        if (degree >= 3) {
            hubCount += 1;
            hubSpeedBeforeTotal += speedBefore;

            const fMag = Math.sqrt(node.fx * node.fx + node.fy * node.fy);
            const isTrappedHub = fMag < trappedForceEpsilon && speedBefore < trappedVelocityEpsilon;
            if (isTrappedHub) {
                trappedHubCount += 1;
                dampScale = Math.min(speedBefore / trappedVelocityEpsilon, 1);
                if (dampScale === 0) {
                    skippedHubCount += 1;
                }
            }
        }

        const damp = 1 - resistance * expResist * dampScale;
        node.vx *= damp;
        node.vy *= damp;

        const dvx = node.vx - beforeVx;
        const dvy = node.vy - beforeVy;
        const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
        if (deltaMag > 0) {
            passStats.velocity += deltaMag;
            affected.add(node.id);
        }

        if (degree >= 3) {
            const speedAfter = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
            hubSpeedAfterTotal += speedAfter;
        }
    }

    passStats.nodes += affected.size;
    stats.expansionResistance.trappedHubCount = trappedHubCount;
    stats.expansionResistance.skippedHubCount = skippedHubCount;
    if (hubCount > 0) {
        stats.expansionResistance.avgHubSpeedBefore = hubSpeedBeforeTotal / hubCount;
        stats.expansionResistance.avgHubSpeedAfter = hubSpeedAfterTotal / hubCount;
    }
};
