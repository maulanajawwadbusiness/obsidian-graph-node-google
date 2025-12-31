import type { PhysicsEngine } from '../engine';
import type { PhysicsNode } from '../types';

export const computeNodeDegrees = (engine: PhysicsEngine, nodeList: PhysicsNode[]) => {
    const nodeDegree = new Map<string, number>();
    for (const node of nodeList) {
        nodeDegree.set(node.id, 0);
    }
    for (const link of engine.links) {
        nodeDegree.set(link.source, (nodeDegree.get(link.source) || 0) + 1);
        nodeDegree.set(link.target, (nodeDegree.get(link.target) || 0) + 1);
    }

    return nodeDegree;
};
