import type { PhysicsNode } from '../../types';

export const applyDamping = (
    node: PhysicsNode,
    preRollActive: boolean,
    effectiveDamping: number,
    nodeDt: number
) => {
    if (preRollActive) {
        // Pre-roll: heavy damping (fixed per frame as pre-roll is frame-counted? No, should be time based too ideally but let's stick to main feel first)
        // Actually pre-roll is frame-counted in engine, so per-tick damping is technically consistent with "frame-based" pre-roll.
        // But let's normalize it to 60fps baseline: 0.995^60 ≈ 0.74/s
        const preRollDamp = Math.pow(0.995, nodeDt * 60);
        node.vx *= preRollDamp;
        node.vy *= preRollDamp;
    } else {
        // Main damping: Exponential decay
        // Original: (1 - effectiveDamping * dt * 5.0) which is approx exp(-effectiveDamping * 5.0 * dt)
        node.vx *= Math.exp(-effectiveDamping * 5.0 * nodeDt);
        node.vy *= Math.exp(-effectiveDamping * 5.0 * nodeDt);
    }
};
