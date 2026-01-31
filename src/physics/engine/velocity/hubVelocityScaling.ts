import type { PhysicsEngine } from '../../engine';
import type { PhysicsNode } from '../../types';
import type { MotionPolicy } from '../motionPolicy';
import { getPassStats, type DebugStats } from '../stats';

export const applyHubVelocityScaling = (
    engine: PhysicsEngine,
    node: PhysicsNode,
    stats: DebugStats,
    policy: MotionPolicy,
    nodeList: PhysicsNode[]
) => {
    let nodeDeg = 0;
    for (const link of engine.links) {
        if (link.source === node.id || link.target === node.id) nodeDeg++;
    }
    if (nodeDeg > 2) {
        // DENSE-CORE DAMPING BYPASS
        // During early expansion, skip damping for nodes in dense clusters
        const denseBypass = policy.denseBypass;
        let isDense = false;

        if (denseBypass > 0.01) {
            // Count neighbors within 0.8 * minNodeDistance
            const denseRadius = engine.config.minNodeDistance * 0.8;
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
            isDense = nearNeighborCount >= 3;
        }

        const hubFactor = Math.min((nodeDeg - 2) / 4, 1);
        const hubVelocityScale = 0.7;  // How slow hubs respond
        const velScale = 1.0 - hubFactor * (1.0 - hubVelocityScale);
        const bypassScale = isDense ? (1 - denseBypass) : 1;
        const effectiveVelScale = 1 - (1 - velScale) * bypassScale;

        const beforeVx = node.vx;
        const beforeVy = node.vy;
        node.vx *= effectiveVelScale;
        node.vy *= effectiveVelScale;

        const dvx = node.vx - beforeVx;
        const dvy = node.vy - beforeVy;
        const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
        if (deltaMag > 0) {
            const passStats = getPassStats(stats, 'HubVelocityScaling');
            passStats.velocity += deltaMag;
            passStats.nodes += 1;
        }
    }
};
