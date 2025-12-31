import type { PhysicsEngine } from '../engine';
import type { PhysicsNode } from '../types';
import { applyRepulsion, applySprings, applyBoundaryForce, applyCollision } from '../forces';

export const applyForcePass = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    forceScale: number,
    dt: number
) => {
    // 1. Clear forces
    for (const node of nodeList) {
        node.fx = 0;
        node.fy = 0;
    }

    // 2. Apply Core Forces (scaled by energy)
    applyRepulsion(nodeList, engine.config);
    applyCollision(nodeList, engine.config, 1.0);
    applySprings(engine.nodes, engine.links, engine.config, 1.0, forceScale);
    applyBoundaryForce(nodeList, engine.config, engine.worldWidth, engine.worldHeight);

    // Scale all forces by energy envelope
    for (const node of nodeList) {
        node.fx *= forceScale;
        node.fy *= forceScale;
    }

    // 3. Apply Mouse Drag Force (NOT scaled - cursor always wins)
    if (engine.draggedNodeId && engine.dragTarget) {
        const node = engine.nodes.get(engine.draggedNodeId);
        if (node) {
            const dx = engine.dragTarget.x - node.x;
            const dy = engine.dragTarget.y - node.y;
            const dragStrength = 200.0;
            node.fx += dx * dragStrength;
            node.fy += dy * dragStrength;
            node.vx += dx * 2.0 * dt;
            node.vy += dy * 2.0 * dt;
        }
    }
};
