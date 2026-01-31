import type { PhysicsEngine } from '../engine';
import type { PhysicsNode } from '../types';
import type { MotionPolicy } from './motionPolicy';
import type { UnifiedMotionState } from './unifiedMotionState';

export type SettleState = 'moving' | 'cooling' | 'microkill' | 'sleep';

export type SettleDebugStats = {
    settleState: SettleState;
    timeToSleepMs: number;
    jitterAvg: number;
};

const ensureBuffer = (buffer: Float32Array, requiredLength: number) => {
    if (buffer.length >= requiredLength) return buffer;
    return new Float32Array(requiredLength);
};

export const applySettleLadder = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    motionState: UnifiedMotionState,
    motionPolicy: MotionPolicy,
    dt: number,
    maxVelocityEffective: number
): SettleDebugStats => {
    const minDistance = Math.max(1, engine.config.minNodeDistance);
    const speedScale = Math.max(1, maxVelocityEffective);

    let speedSum = 0;
    let correctionSum = 0;
    for (const node of nodeList) {
        const speed = Math.hypot(node.vx, node.vy);
        speedSum += speed;
        correctionSum += node.lastCorrectionMag ?? 0;
    }

    const avgSpeed = nodeList.length > 0 ? speedSum / nodeList.length : 0;
    const avgCorrection = nodeList.length > 0 ? correctionSum / nodeList.length : 0;
    const speedNorm = avgSpeed / speedScale;
    const correctionNorm = avgCorrection / minDistance;

    const moving = motionState.temperature > motionPolicy.settle.movingTemp ||
        speedNorm > motionPolicy.settle.movingSpeed ||
        correctionNorm > motionPolicy.settle.movingCorrection;
    const cooling = motionState.temperature > motionPolicy.settle.coolingTemp ||
        speedNorm > motionPolicy.settle.coolingSpeed ||
        correctionNorm > motionPolicy.settle.coolingCorrection;
    const microkill = speedNorm > motionPolicy.settle.microSpeed ||
        correctionNorm > motionPolicy.settle.microCorrection;

    const settleState: SettleState = moving
        ? 'moving'
        : cooling
            ? 'cooling'
            : microkill
                ? 'microkill'
                : 'sleep';

    if (engine.settleState !== settleState) {
        engine.settleState = settleState;
        engine.settleStateMs = 0;
    } else {
        engine.settleStateMs += dt * 1000;
    }

    const jitterBufferSize = nodeList.length * 2;
    engine.settlePositionCache = ensureBuffer(engine.settlePositionCache, jitterBufferSize);
    let jitterSum = 0;
    for (let i = 0; i < nodeList.length; i++) {
        const node = nodeList[i];
        const idx = i * 2;
        const dx = node.x - engine.settlePositionCache[idx];
        const dy = node.y - engine.settlePositionCache[idx + 1];
        jitterSum += Math.hypot(dx, dy);
        engine.settlePositionCache[idx] = node.x;
        engine.settlePositionCache[idx + 1] = node.y;
    }
    const jitterAvg = nodeList.length > 0 ? jitterSum / nodeList.length : 0;
    engine.settleJitterAvg = engine.settleJitterAvg * 0.9 + jitterAvg * 0.1;

    const microKillStrength = motionPolicy.settle.microKillStrength;

    for (const node of nodeList) {
        if (node.isFixed || node.id === engine.draggedNodeId) continue;

        if (settleState === 'microkill' || settleState === 'sleep') {
            node.vx *= 1 - microKillStrength;
            node.vy *= 1 - microKillStrength;
        }

        if (settleState !== 'sleep' || motionState.authority === 'dragged') {
            node.sleepFrames = 0;
            node.isSleeping = false;
            continue;
        }

        const nodeSpeedNorm = Math.hypot(node.vx, node.vy) / speedScale;
        const nodeCorrectionNorm = (node.lastCorrectionMag ?? 0) / minDistance;
        const jitterNorm = engine.settleJitterAvg / minDistance;

        const shouldSleep = nodeSpeedNorm < motionPolicy.settle.sleepSpeed &&
            nodeCorrectionNorm < motionPolicy.settle.sleepCorrection &&
            jitterNorm < motionPolicy.settle.sleepJitter;

        if (shouldSleep) {
            node.sleepFrames = (node.sleepFrames ?? 0) + 1;
            if (node.sleepFrames >= (engine.config.sleepFramesThreshold ?? 30)) {
                node.isSleeping = true;
                node.vx = 0;
                node.vy = 0;
            }
        } else {
            node.sleepFrames = 0;
            node.isSleeping = false;
        }
    }

    return {
        settleState,
        timeToSleepMs: engine.settleStateMs,
        jitterAvg: engine.settleJitterAvg,
    };
};
