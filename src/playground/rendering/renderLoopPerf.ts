import { gradientCache } from './gradientCache';
import { isDebugEnabled } from './debugUtils';

export type PerfSample = {
    lastReportAt: number;
    frameCount: number;
    tickCount: number;
    tickMsTotal: number;
    tickMsMax: number;
    tickMsSamples: number[];
    droppedMsTotal: number;
    maxTicksPerFrame: number;
    lastDtMs: number;
    lastAccumulatorMs: number;
    lastSteps: number;
    lastDroppedMs: number;
    lastPhysicsMs: number;
};

export type OverloadState = {
    active: boolean;
    reason: string;
    severity: 'NONE' | 'SOFT' | 'HARD';
    overloadCount: number;
    freezeCount: number;
    debtFrames: number;
    lastLogAt: number;
    lastOverloadAt: number;
    lastFreezeAt: number;
    pendingHardFreeze: boolean;
    pendingReason: string;
    degradeLevel: number;
    degradeReason: string;
    degradeHoldFrames: number;
};

export const createPerfSample = (): PerfSample => ({
    lastReportAt: 0,
    frameCount: 0,
    tickCount: 0,
    tickMsTotal: 0,
    tickMsMax: 0,
    tickMsSamples: [],
    droppedMsTotal: 0,
    maxTicksPerFrame: 0,
    lastDtMs: 0,
    lastAccumulatorMs: 0,
    lastSteps: 0,
    lastDroppedMs: 0,
    lastPhysicsMs: 0,
});

export const createOverloadState = (): OverloadState => ({
    active: false,
    reason: 'NONE',
    severity: 'NONE',
    overloadCount: 0,
    freezeCount: 0,
    debtFrames: 0,
    lastLogAt: 0,
    lastOverloadAt: 0,
    lastFreezeAt: 0,
    pendingHardFreeze: false,
    pendingReason: 'NONE',
    degradeLevel: 0,
    degradeReason: 'NONE',
    degradeHoldFrames: 0,
});

export const recordPerfSample = (
    perfSample: PerfSample,
    overloadState: OverloadState,
    stepsThisFrame: number,
    tickMsTotal: number,
    droppedMs: number,
    dtMs: number,
    accumulatorMs: number,
    physicsMs: number,
    baseBudget: number,
    now: number
) => {
    perfSample.frameCount += 1;
    perfSample.tickCount += stepsThisFrame;
    perfSample.tickMsTotal += tickMsTotal;
    perfSample.maxTicksPerFrame = Math.max(perfSample.maxTicksPerFrame, stepsThisFrame);
    perfSample.droppedMsTotal += droppedMs;
    perfSample.lastDtMs = dtMs;
    perfSample.lastAccumulatorMs = accumulatorMs;
    perfSample.lastSteps = stepsThisFrame;
    perfSample.lastDroppedMs = droppedMs;
    perfSample.lastPhysicsMs = physicsMs;

    if (droppedMs > 0 && overloadState.reason !== 'NONE') {
        const nowLog = performance.now();
        if (nowLog - (overloadState.lastLogAt || 0) > 1000) {
            console.log(
                `[RenderPerf] droppedMs=${droppedMs.toFixed(1)} ` +
                `reason=${overloadState.reason} ` +
                `budgetMs=${baseBudget.toFixed(1)} ` +
                `ticksThisFrame=${stepsThisFrame} ` +
                `avgTickMs=${perfSample.tickMsTotal / (perfSample.tickCount || 1)}`
            );
            overloadState.lastLogAt = nowLog;
        }
    }

    if (perfSample.lastReportAt === 0) {
        perfSample.lastReportAt = now;
    }
    const elapsed = now - perfSample.lastReportAt;
    if (elapsed >= 1000) {
        if (!isDebugEnabled(true)) {
            perfSample.tickMsSamples = [];
            perfSample.lastReportAt = now;
            perfSample.frameCount = 0;
            perfSample.tickCount = 0;
            perfSample.maxTicksPerFrame = 0;
            return;
        }

        const frames = perfSample.frameCount || 1;
        const ticks = perfSample.tickCount || 1;
        const fps = frames / (elapsed / 1000);
        const rafHz = fps;
        const avgTickMs = perfSample.tickMsSamples.length
            ? perfSample.tickMsSamples.reduce((sum, v) => sum + v, 0) / perfSample.tickMsSamples.length
            : (perfSample.lastSteps > 0 ? perfSample.lastPhysicsMs / perfSample.lastSteps : 0);
        const sorted = perfSample.tickMsSamples.slice().sort((a, b) => a - b);
        const p95Index = sorted.length ? Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95)) : 0;
        const p95TickMs = sorted.length ? sorted[p95Index] : 0;
        const ticksPerSecond = ticks / (elapsed / 1000);
        const freezeRecently = now - overloadState.lastFreezeAt < 1000;
        console.log(
            `[RenderPerf] fps=${fps.toFixed(1)} ` +
            `rafHz=${rafHz.toFixed(1)} ` +
            `dt=${perfSample.lastDtMs.toFixed(1)} ` +
            `accumulatorMs=${perfSample.lastAccumulatorMs.toFixed(1)} ` +
            `steps=${perfSample.lastSteps} ` +
            `ticksPerSecond=${ticksPerSecond.toFixed(1)} ` +
            `droppedMs=${perfSample.lastDroppedMs.toFixed(1)}`
        );
        console.log(
            `[Overload] active=${overloadState.active} ` +
            `severity=${overloadState.severity} ` +
            `reason=${overloadState.reason} ` +
            `freezeTriggered=${freezeRecently} ` +
            `freezeCount=${overloadState.freezeCount} ` +
            `overloadCount=${overloadState.overloadCount}`
        );
        console.log(
            `[SlushWatch] debtFrames=${overloadState.debtFrames} ` +
            `accumulatorMs=${perfSample.lastAccumulatorMs.toFixed(1)} ` +
            `avgTickMs=${avgTickMs.toFixed(3)}`
        );
        console.log(
            `[RenderPerf] avgTickMs=${avgTickMs.toFixed(3)} ` +
            `p95TickMs=${p95TickMs.toFixed(3)} ` +
            `maxTickMs=${perfSample.tickMsMax.toFixed(3)} ` +
            `ticksPerSecond=${ticksPerSecond.toFixed(1)} ` +
            `ticksPerFrame=${(ticks / frames).toFixed(2)} ` +
            `maxTicksPerFrame=${perfSample.maxTicksPerFrame} ` +
            `droppedMs=${perfSample.droppedMsTotal.toFixed(1)} ` +
            `frames=${frames}`
        );
        perfSample.lastReportAt = now;
        perfSample.frameCount = 0;
        perfSample.tickCount = 0;
        perfSample.tickMsTotal = 0;
        perfSample.tickMsMax = 0;
        perfSample.tickMsSamples = [];
        perfSample.droppedMsTotal = 0;
        perfSample.maxTicksPerFrame = 0;

        if (gradientCache.misses > 0 || gradientCache.hits > 0) {
            console.log(
                `[GradientCache] hits=${gradientCache.hits} ` +
                `misses/created=${gradientCache.misses} ` +
                `(HitRat=${(gradientCache.hits / (gradientCache.hits + gradientCache.misses) * 100).toFixed(1)}%)`
            );
            gradientCache.resetStats();
        }
    }
};
