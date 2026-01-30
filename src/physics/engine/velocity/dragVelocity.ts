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

    const targetX = engine.dragTarget.x;
    const targetY = engine.dragTarget.y;

    // KINEMATIC AUTHORITY: Override position directly (0 lag)
    const prevX = node.x;
    const prevY = node.y;

    node.x = targetX;
    node.y = targetY;

    // Infer velocity for momentum preservation (so release feels right)
    // vx = delta / dt
    if (dt > 0) {
        node.vx = (targetX - prevX) / dt;
        node.vy = (targetY - prevY) / dt;
    }

    // Lock stats
    const passStats = getPassStats(stats, 'DragVelocity');
    passStats.nodes += 1;
    // We don't log velocity magnitude here as it's not a force application
};
