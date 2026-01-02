import type { PhysicsEngine } from '../../engine';
import type { PhysicsNode } from '../../types';
import { getPassStats, type DebugStats } from '../stats';

export const applyCarrierFlowAndPersistence = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    node: PhysicsNode,
    energy: number,
    stats: DebugStats
) => {
    if (energy <= 0.7) return;

    const passStats = getPassStats(stats, 'CarrierFlow');
    let nodeVelocityDelta = 0;

    // Count degree inline
    let deg = 0;
    for (const link of engine.links) {
        if (link.source === node.id || link.target === node.id) deg++;
    }

    if (deg >= 3) {
        // TRAPPED HUB CARRIER FLOW
        // Detect trapped hub: low net force AND low velocity
        const fMag = Math.sqrt(node.fx * node.fx + node.fy * node.fy);
        const vMag = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        const forceEpsilon = 1.0;
        const velocityThreshold = 0.5;

        const isTrapped = fMag < forceEpsilon && vMag < velocityThreshold;

        if (isTrapped) {
            // Compute local cluster centroid (nearby hub nodes)
            let clusterCx = 0, clusterCy = 0;
            let clusterCount = 0;

            for (const otherNode of nodeList) {
                if (otherNode.id === node.id) continue;
                const dx = otherNode.x - node.x;
                const dy = otherNode.y - node.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Only nearby nodes (within 2x minNodeDistance)
                if (dist < engine.config.minNodeDistance * 2) {
                    clusterCx += otherNode.x;
                    clusterCy += otherNode.y;
                    clusterCount++;
                }
            }

            if (clusterCount > 0) {
                clusterCx /= clusterCount;
                clusterCy /= clusterCount;

                // Direction from centroid to node
                const toCx = node.x - clusterCx;
                const toCy = node.y - clusterCy;
                const toD = Math.sqrt(toCx * toCx + toCy * toCy);

                if (toD > 0.1) {
                    // Perpendicular direction (tangent to centroid)
                    const perpX = -toCy / toD;
                    const perpY = toCx / toD;

                    // Fade: 1.0 at energy=1.0, 0.0 at energy=0.7
                    const fade = Math.min((energy - 0.7) / 0.3, 1);
                    const smoothFade = fade * fade * (3 - 2 * fade);

                    // Very small velocity bias
                    const carrierStrength = 0.05 * smoothFade;

                    node.vx += perpX * carrierStrength;
                    node.vy += perpY * carrierStrength;
                    nodeVelocityDelta += Math.abs(carrierStrength);

                    // RELIABILITY GATE: only store direction if well-defined
                    const centroidEpsilon = 2.0;  // Minimum centroid distance
                    const forceEpsilon = 0.5;     // Minimum net force
                    const directionReliable = toD > centroidEpsilon || fMag > forceEpsilon;

                    if (directionReliable) {
                        // STORE CARRIER DIRECTION for directional persistence
                        engine.carrierDir.set(node.id, { x: perpX, y: perpY });
                        engine.carrierTimer.set(node.id, 20);  // ~330ms at 60fps
                    } else {
                        // Direction ill-defined - HARD DISABLE persistence
                        engine.carrierDir.delete(node.id);
                        engine.carrierTimer.delete(node.id);
                    }
                } else {
                    // Too close to centroid - disable persistence
                    engine.carrierDir.delete(node.id);
                    engine.carrierTimer.delete(node.id);
                }
            }
        }
    }

    // DIRECTIONAL PERSISTENCE: filter spring forces that oppose carrier direction
    const cDir = engine.carrierDir.get(node.id);
    const cTimer = engine.carrierTimer.get(node.id) || 0;

    if (cDir && cTimer > 0) {
        // Decrement timer
        engine.carrierTimer.set(node.id, cTimer - 1);

        // Check if velocity exceeds threshold (symmetry broken, persistence no longer needed)
        const vMagNow = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (vMagNow > 3.0) {
            // Clear persistence
            engine.carrierDir.delete(node.id);
            engine.carrierTimer.delete(node.id);
        } else {
            // Filter spring force: project out component opposing carrier direction
            const fDotC = node.fx * cDir.x + node.fy * cDir.y;
            if (fDotC < 0) {
                // Force opposes carrier direction - remove opposing component
                const filterStrength = 0.7;  // How much to filter (1.0 = complete)
                const beforeFx = node.fx;
                const beforeFy = node.fy;
                node.fx -= fDotC * cDir.x * filterStrength;
                node.fy -= fDotC * cDir.y * filterStrength;

                const dFx = node.fx - beforeFx;
                const dFy = node.fy - beforeFy;
                passStats.force += Math.sqrt(dFx * dFx + dFy * dFy);
            }
        }
    } else if (cTimer <= 0 && cDir) {
        // Timer expired, clear carrier direction
        engine.carrierDir.delete(node.id);
        engine.carrierTimer.delete(node.id);
    }

    if (nodeVelocityDelta > 0) {
        passStats.velocity += nodeVelocityDelta;
        passStats.nodes += 1;
    }
};
