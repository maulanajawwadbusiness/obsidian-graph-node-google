import type { PhysicsNode } from '../../types';

export const applyDamping = (
    node: PhysicsNode,
    preRollActive: boolean,
    effectiveDamping: number,
    nodeDt: number
) => {
    if (preRollActive) {
        node.vx *= 0.995;
        node.vy *= 0.995;
    } else {
        node.vx *= (1 - effectiveDamping * nodeDt * 5.0);
        node.vy *= (1 - effectiveDamping * nodeDt * 5.0);
    }
};
