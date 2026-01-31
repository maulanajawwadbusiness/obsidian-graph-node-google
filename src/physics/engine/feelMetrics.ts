import type { ForceConfig, PhysicsLink, PhysicsNode } from '../types';
import type { DebugStats } from './stats';
import { getNowMs } from './engineTime';

export type FeelMetricsState = {
    lastLogAt: number;
    windowFrames: number;
    avgSpeedSum: number;
    settleFrames: number;
    settleFramesNeeded: number;
    settleSpeedEps: number;
    timeToSettleMs: number | null;
    microJitterSum: number;
    microJitterFrames: number;
    overshootMax: number;
    residualLastLogTotal: number;
    correctionSum: number;
    degradeCounts: [number, number, number];
    passSkipped: {
        repulsion: number;
        collision: number;
        springs: number;
        spacing: number;
        triangle: number;
        safety: number;
        micro: number;
    };
};

export type FeelMetricsEngine = {
    config: ForceConfig;
    lifecycle: number;
    links: PhysicsLink[];
    draggedNodeId: string | null;
};

export type FeelMetricsPassState = {
    degradeLevel: number;
    repulsionEnabled: boolean;
    collisionEnabled: boolean;
    springsEnabled: boolean;
    spacingEnabled: boolean;
    triangleEnabled: boolean;
    safetyEnabled: boolean;
    microEnabled: boolean;
};

export const createFeelMetrics = (): FeelMetricsState => ({
    lastLogAt: 0,
    windowFrames: 0,
    avgSpeedSum: 0,
    settleFrames: 0,
    settleFramesNeeded: 30,
    settleSpeedEps: 0.03,
    timeToSettleMs: null,
    microJitterSum: 0,
    microJitterFrames: 0,
    overshootMax: 0,
    residualLastLogTotal: 0,
    correctionSum: 0,
    degradeCounts: [0, 0, 0],
    passSkipped: {
        repulsion: 0,
        collision: 0,
        springs: 0,
        spacing: 0,
        triangle: 0,
        safety: 0,
        micro: 0,
    },
});

export const resetFeelMetrics = (state: FeelMetricsState) => {
    state.lastLogAt = 0;
    state.windowFrames = 0;
    state.avgSpeedSum = 0;
    state.settleFrames = 0;
    state.timeToSettleMs = null;
    state.microJitterSum = 0;
    state.microJitterFrames = 0;
    state.overshootMax = 0;
    state.residualLastLogTotal = 0;
    state.correctionSum = 0;
    state.degradeCounts = [0, 0, 0];
    state.passSkipped.repulsion = 0;
    state.passSkipped.collision = 0;
    state.passSkipped.springs = 0;
    state.passSkipped.spacing = 0;
    state.passSkipped.triangle = 0;
    state.passSkipped.safety = 0;
    state.passSkipped.micro = 0;
};

const sumCorrection = (stats: DebugStats): number => {
    const passes = stats.passes;
    let total = 0;
    for (const name of [
        'EdgeRelaxation',
        'SpacingConstraints',
        'TriangleAreaConstraints',
        'SafetyClamp',
        'Corrections',
    ]) {
        total += passes[name]?.correction ?? 0;
    }
    return total;
};

export const updateFeelMetrics = (
    state: FeelMetricsState,
    engine: FeelMetricsEngine,
    nodeList: PhysicsNode[],
    stats: DebugStats,
    passState: FeelMetricsPassState
) => {
    const now = getNowMs();
    if (state.lastLogAt === 0) {
        state.lastLogAt = now;
    }

    const speedEps = Math.max(
        0.01,
        Math.min(0.1, (engine.config.velocitySleepThreshold ?? 0.1) * 0.5)
    );
    state.settleSpeedEps = speedEps;

    let speedSum = 0;
    let speedCount = 0;
    let residualTotal = 0;
    let residualMax = 0;
    const nodeById = new Map<string, PhysicsNode>();

    for (const node of nodeList) {
        nodeById.set(node.id, node);
        if (node.isFixed) continue;
        const v = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        speedSum += v;
        speedCount += 1;

        if (node.correctionResidual) {
            const dx = node.correctionResidual.dx;
            const dy = node.correctionResidual.dy;
            const mag = Math.sqrt(dx * dx + dy * dy);
            residualTotal += mag;
            residualMax = Math.max(residualMax, mag);
        }
    }

    const avgSpeed = speedCount > 0 ? speedSum / speedCount : 0;
    state.avgSpeedSum += avgSpeed;
    state.windowFrames += 1;

    if (avgSpeed < speedEps) {
        state.settleFrames += 1;
        state.microJitterSum += avgSpeed;
        state.microJitterFrames += 1;
    } else {
        state.settleFrames = 0;
    }

    if (state.timeToSettleMs === null && state.settleFrames >= state.settleFramesNeeded) {
        state.timeToSettleMs = Math.round(engine.lifecycle * 1000);
    }

    let overshootMax = 0;
    for (const link of engine.links) {
        const source = nodeById.get(link.source);
        const target = nodeById.get(link.target);
        if (!source || !target) continue;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const rest = link.length || engine.config.linkRestLength;
        const overshoot = Math.max(0, dist - rest);
        overshootMax = Math.max(overshootMax, overshoot);
    }
    state.overshootMax = Math.max(state.overshootMax, overshootMax);

    state.correctionSum += sumCorrection(stats);

    const degrade = Math.max(0, Math.min(2, passState.degradeLevel));
    state.degradeCounts[degrade] += 1;
    if (!passState.repulsionEnabled) state.passSkipped.repulsion += 1;
    if (!passState.collisionEnabled) state.passSkipped.collision += 1;
    if (!passState.springsEnabled) state.passSkipped.springs += 1;
    if (!passState.spacingEnabled) state.passSkipped.spacing += 1;
    if (!passState.triangleEnabled) state.passSkipped.triangle += 1;
    if (!passState.safetyEnabled) state.passSkipped.safety += 1;
    if (!passState.microEnabled) state.passSkipped.micro += 1;

    if (now - state.lastLogAt < 1000) {
        return;
    }

    const frames = Math.max(1, state.windowFrames);
    const avgSpeedWindow = state.avgSpeedSum / frames;
    const jitterAvg = state.microJitterFrames > 0
        ? state.microJitterSum / state.microJitterFrames
        : 0;
    const avgCorrection = state.correctionSum / frames;
    const residualDelta = residualTotal - state.residualLastLogTotal;
    const degrade0 = (state.degradeCounts[0] / frames) * 100;
    const degrade1 = (state.degradeCounts[1] / frames) * 100;
    const degrade2 = (state.degradeCounts[2] / frames) * 100;

    console.log(
        `[PhysicsScale] avgSpeed=${avgSpeedWindow.toFixed(3)} ` +
        `settleMs=${state.timeToSettleMs ?? 'n/a'} ` +
        `jitterAvg=${jitterAvg.toFixed(4)} ` +
        `overshootMax=${state.overshootMax.toFixed(2)} ` +
        `corrAvg=${avgCorrection.toFixed(2)} ` +
        `residualSum=${residualTotal.toFixed(2)} ` +
        `residualMax=${residualMax.toFixed(2)} ` +
        `residualDelta=${residualDelta.toFixed(2)} ` +
        `degrade%=[${degrade0.toFixed(1)},${degrade1.toFixed(1)},${degrade2.toFixed(1)}] ` +
        `skip={repel:${state.passSkipped.repulsion},coll:${state.passSkipped.collision},` +
        `spring:${state.passSkipped.springs},space:${state.passSkipped.spacing},` +
        `tri:${state.passSkipped.triangle},safety:${state.passSkipped.safety},micro:${state.passSkipped.micro}}`
    );

    state.lastLogAt = now;
    state.windowFrames = 0;
    state.avgSpeedSum = 0;
    state.microJitterSum = 0;
    state.microJitterFrames = 0;
    state.overshootMax = 0;
    state.correctionSum = 0;
    state.residualLastLogTotal = residualTotal;
    state.degradeCounts = [0, 0, 0];
    state.passSkipped.repulsion = 0;
    state.passSkipped.collision = 0;
    state.passSkipped.springs = 0;
    state.passSkipped.spacing = 0;
    state.passSkipped.triangle = 0;
    state.passSkipped.safety = 0;
    state.passSkipped.micro = 0;
};
