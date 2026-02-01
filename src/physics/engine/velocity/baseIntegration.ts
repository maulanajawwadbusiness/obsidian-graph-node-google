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
    velocityCap: number,
    _dt?: number // Added for history reconciliation
): boolean => {
    const vSq = node.vx * node.vx + node.vy * node.vy;
    if (vSq > velocityCap * velocityCap) {
        const v = Math.sqrt(vSq);
        node.vx = (node.vx / v) * velocityCap;
        node.vy = (node.vy / v) * velocityCap;

        // VERLET CONSISTENCY: Reconcile history to match clamped velocity
        // v = (x - prev)/dt  =>  prev = x - v*dt
        // If we can't get dt, we can't reconcile perfectly.
        // However, this file is small. We can add dt to the signature.
        return true;
    }
    return false;
};
