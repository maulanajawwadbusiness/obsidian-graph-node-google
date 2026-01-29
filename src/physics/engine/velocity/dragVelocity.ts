import type { PhysicsEngine } from '../../engine';
import type { PhysicsNode } from '../../types';
import { getPassStats, type DebugStats } from '../stats';

export const applyDragVelocity = (
    engine: PhysicsEngine,
    _nodeList: PhysicsNode[],
    dt: number,
    stats: DebugStats
) => {
    if (!engine.draggedNodeId || !engine.dragTarget) return;

    const node = engine.nodes.get(engine.draggedNodeId);
    if (!node) return;

    const dx = engine.dragTarget.x - node.x;
    const dy = engine.dragTarget.y - node.y;

    const dvx = dx * 2.0 * dt;
    const dvy = dy * 2.0 * dt;

    if (!node.isFixed) {
        node.vx += dvx;
        node.vy += dvy;
    }

    const passStats = getPassStats(stats, 'DragVelocity');
    const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
    if (deltaMag > 0) {
        passStats.velocity += deltaMag;
        passStats.nodes += 1;
    }
};
