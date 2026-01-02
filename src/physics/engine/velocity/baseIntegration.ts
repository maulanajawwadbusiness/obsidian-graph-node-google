import type { PhysicsNode } from '../../types';

export const applyBaseIntegration = (
    node: PhysicsNode,
    ax: number,
    ay: number,
    nodeDt: number
) => {
    node.vx += ax * nodeDt;
    node.vy += ay * nodeDt;
};

export const clampVelocity = (
    node: PhysicsNode,
    velocityCap: number
): boolean => {
    const vSq = node.vx * node.vx + node.vy * node.vy;
    if (vSq > velocityCap * velocityCap) {
        const v = Math.sqrt(vSq);
        node.vx = (node.vx / v) * velocityCap;
        node.vy = (node.vy / v) * velocityCap;
        return true;
    }
    return false;
};
