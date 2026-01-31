import type { PhysicsNode } from '../types';

type ReconcileStats = {
    pbdDeltaSum: number;
    vReconAppliedSum: number;
};

const ensureBuffer = (buffer: Float32Array, requiredLength: number) => {
    if (buffer.length >= requiredLength) return buffer;
    return new Float32Array(requiredLength);
};

export const capturePositionSnapshot = (
    nodeList: PhysicsNode[],
    buffer: Float32Array
) => {
    const requiredLength = nodeList.length * 2;
    const nextBuffer = ensureBuffer(buffer, requiredLength);
    for (let i = 0; i < nodeList.length; i++) {
        const node = nodeList[i];
        const idx = i * 2;
        nextBuffer[idx] = node.x;
        nextBuffer[idx + 1] = node.y;
    }
    return nextBuffer;
};

export const reconcileVelocityFromPositionDelta = (
    nodeList: PhysicsNode[],
    buffer: Float32Array,
    dt: number,
    draggedNodeId: string | null
): ReconcileStats => {
    if (dt <= 0) {
        return { pbdDeltaSum: 0, vReconAppliedSum: 0 };
    }

    let pbdDeltaSum = 0;
    let vReconAppliedSum = 0;
    const invDt = 1 / dt;

    for (let i = 0; i < nodeList.length; i++) {
        const node = nodeList[i];
        if (node.isFixed || node.id === draggedNodeId) continue;

        const idx = i * 2;
        const dx = node.x - buffer[idx];
        const dy = node.y - buffer[idx + 1];
        if (dx === 0 && dy === 0) continue;

        const disp = Math.sqrt(dx * dx + dy * dy);
        pbdDeltaSum += disp;

        const dvx = dx * invDt;
        const dvy = dy * invDt;
        node.vx += dvx;
        node.vy += dvy;

        vReconAppliedSum += Math.sqrt(dvx * dvx + dvy * dvy);
    }

    return { pbdDeltaSum, vReconAppliedSum };
};
