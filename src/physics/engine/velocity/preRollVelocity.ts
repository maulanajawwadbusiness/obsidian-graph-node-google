import type { PhysicsEngine } from '../../engine';
import type { PhysicsNode } from '../../types';
import { getPassStats, type DebugStats } from '../stats';

export const applyPreRollVelocity = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    preRollActive: boolean,
    stats: DebugStats
) => {
    if (!preRollActive) return;

    const passStats = getPassStats(stats, 'PreRollVelocity');
    const affected = new Set<string>();

    // Apply spacing repulsion between all pairs
    const minDist = engine.config.minNodeDistance;
    for (let i = 0; i < nodeList.length; i++) {
        const a = nodeList[i];
        for (let j = i + 1; j < nodeList.length; j++) {
            const b = nodeList[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.sqrt(dx * dx + dy * dy);

            if (d < minDist && d > 0.1) {
                const overlap = minDist - d;
                const nx = dx / d;
                const ny = dy / d;

                // Apply as velocity, not position
                const strength = overlap * 2.0;  // Moderate push
                let deltaMag = 0;

                if (!a.isFixed) {
                    const dvx = -nx * strength;
                    const dvy = -ny * strength;
                    a.vx += dvx;
                    a.vy += dvy;
                    deltaMag += Math.sqrt(dvx * dvx + dvy * dvy);
                    affected.add(a.id);
                }
                if (!b.isFixed) {
                    const dvx = nx * strength;
                    const dvy = ny * strength;
                    b.vx += dvx;
                    b.vy += dvy;
                    deltaMag += Math.sqrt(dvx * dvx + dvy * dvy);
                    affected.add(b.id);
                }

                passStats.velocity += deltaMag;
            }
        }
    }

    // Compute centroid for carrier rotation
    let cx = 0, cy = 0;
    for (const node of nodeList) {
        cx += node.x;
        cy += node.y;
    }
    cx /= nodeList.length;
    cy /= nodeList.length;

    // MICRO CARRIER DRIFT: Prevent crystallization into eigenvector directions
    // Adds shared rotational motion so separation feels like drifting water
    // Fades out from frame 5 → 0
    const carrierOmega = 0.03;  // rad/frame, ~1.8 rad/s at 60fps
    const fade = engine.preRollFrames / 5;  // 1.0 at frame 5, 0.2 at frame 1
    const effectiveOmega = carrierOmega * fade;

    // Apply carrier rotation to velocities (rotate velocity frame around centroid)
    for (const node of nodeList) {
        if (node.isFixed) continue;

        // Position relative to centroid
        const rx = node.x - cx;
        const ry = node.y - cy;

        // Tangential velocity from rotation
        const tangentX = -ry * effectiveOmega;
        const tangentY = rx * effectiveOmega;

        node.vx += tangentX;
        node.vy += tangentY;

        const deltaMag = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
        if (deltaMag > 0) {
            passStats.velocity += deltaMag;
            affected.add(node.id);
        }
    }

    passStats.nodes += affected.size;
};
