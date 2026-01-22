import type { PhysicsNode } from '../../types';

export type VelocityAccumulator = {
    vx: number;
    vy: number;
};

export type VelocityProjection = {
    parallelX: number;
    parallelY: number;
    perpX: number;
    perpY: number;
};

export const computeAverageNeighborVelocity = (
    node: PhysicsNode,
    nodeList: PhysicsNode[],
    radius: number,
    out: VelocityAccumulator
): number => {
    let neighborCount = 0;
    let sumVx = 0;
    let sumVy = 0;

    for (const other of nodeList) {
        if (other.id === node.id) continue;
        const dx = other.x - node.x;
        const dy = other.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius) {
            sumVx += other.vx;
            sumVy += other.vy;
            neighborCount++;
        }
    }

    out.vx = sumVx;
    out.vy = sumVy;

    return neighborCount;
};

export const computeRelativeVelocity = (
    source: PhysicsNode,
    target: PhysicsNode,
    out: { x: number; y: number }
) => {
    out.x = source.vx - target.vx;
    out.y = source.vy - target.vy;
};

export const projectVelocityComponents = (
    vx: number,
    vy: number,
    ux: number,
    uy: number,
    out: VelocityProjection
) => {
    const vParallelMag = vx * ux + vy * uy;
    const vParallelX = vParallelMag * ux;
    const vParallelY = vParallelMag * uy;
    out.parallelX = vParallelX;
    out.parallelY = vParallelY;
    out.perpX = vx - vParallelX;
    out.perpY = vy - vParallelY;
};
