import type { PhysicsEngine } from '../../physics/engine';
import { verifyMappingIntegrity } from './camera';
import type { OverloadState, PerfSample } from './renderLoopPerf';

export type SchedulerState = {
    lastTime: number;
    accumulatorMs: number;
};

export type SchedulerResult = {
    dtMs: number;
    accumulatorMs: number;
    droppedMs: number;
    stepsThisFrame: number;
    tickMsTotal: number;
    physicsMs: number;
    baseBudget: number;
    fixedStepMs: number;
    overloadReason: string;
    overloadSeverity: 'NONE' | 'SOFT' | 'HARD';
};

export const runPhysicsScheduler = (
    engine: PhysicsEngine,
    schedulerState: SchedulerState,
    overloadState: OverloadState,
    perfSample: PerfSample
): SchedulerResult => {
    const now = performance.now();
    const targetTickHz = engine.config.targetTickHz || 60;
    const fixedStepMs = 1000 / targetTickHz;
    const isDragging = !!engine.draggedNodeId;
    const maxSteps = isDragging ? 10 : (engine.config.maxStepsPerFrame || 2);
    const baseBudget = engine.config.maxPhysicsBudgetMs ?? (fixedStepMs * maxSteps);
    const effectiveBudget = isDragging ? Infinity : baseBudget;

    if (!isDragging) {
        engine.setDegradeState(
            overloadState.degradeLevel,
            overloadState.degradeReason,
            overloadState.severity,
            baseBudget
        );
    } else {
        engine.setDegradeState(0, 'INTERACTION', 'NONE', Infinity);
    }

    let rawDeltaMs = now - schedulerState.lastTime;

    if (engine.debugSimulateSpikeFrames > 0) {
        rawDeltaMs = 250;
        engine.debugSimulateSpikeFrames--;
    } else if (now < engine.debugSimulateJitterUntil) {
        rawDeltaMs += (Math.random() - 0.5) * 20;
        if (rawDeltaMs < 1) rawDeltaMs = 1;
    }

    const policy = engine.timePolicy.evaluate(rawDeltaMs);
    const frameDeltaMs = policy.dtUseMs;

    const dtMs = frameDeltaMs;
    schedulerState.lastTime = now;

    schedulerState.accumulatorMs += frameDeltaMs;
    const dtHugeMs = engine.config.dtHugeMs ?? 250;

    let freezeThisFrame = false;
    let overloadReason = 'NONE';
    let overloadSeverity: 'NONE' | 'SOFT' | 'HARD' = 'NONE';

    if (schedulerState.accumulatorMs > dtHugeMs * 3) {
        schedulerState.accumulatorMs = 0;
        overloadReason = 'DT_HUGE_RESET';
        overloadSeverity = 'HARD';
        freezeThisFrame = true;
    } else if (isDragging && schedulerState.accumulatorMs > dtHugeMs) {
        schedulerState.accumulatorMs = dtHugeMs;
    }

    const clampedMs = 0;
    let stepsThisFrame = 0;
    let tickMsTotal = 0;
    let physicsMs = 0;

    const recordTick = (durationMs: number) => {
        tickMsTotal += durationMs;
        if (engine.config.debugPerf) {
            perfSample.tickMsSamples.push(durationMs);
            perfSample.tickMsMax = Math.max(perfSample.tickMsMax, durationMs);
        }
    };

    const dtHuge = rawDeltaMs > dtHugeMs;
    const debtWatchdogPrev = overloadState.debtFrames > 2;

    if (dtHuge) {
        freezeThisFrame = true;
        overloadReason = 'DT_HUGE';
        overloadSeverity = 'HARD';
    } else if (debtWatchdogPrev && !isDragging) {
        freezeThisFrame = true;
        overloadReason = 'DEBT_WATCHDOG';
        overloadSeverity = 'HARD';
    } else if (overloadState.pendingHardFreeze) {
        freezeThisFrame = true;
        overloadReason = overloadState.pendingReason;
        overloadSeverity = 'HARD';
    }

    if (freezeThisFrame) {
        overloadState.pendingHardFreeze = false;
        overloadState.pendingReason = 'NONE';
    }

    if (!freezeThisFrame) {
        const physicsStart = performance.now();
        while (schedulerState.accumulatorMs >= fixedStepMs && stepsThisFrame < maxSteps) {
            if (performance.now() - physicsStart >= effectiveBudget) {
                break;
            }
            if (engine.config.debugPerf) {
                const tickStart = performance.now();
                engine.tick(fixedStepMs / 1000);
                recordTick(performance.now() - tickStart);
                if (stepsThisFrame === 0 && Math.random() < 0.05) {
                    verifyMappingIntegrity();
                }
            } else {
                engine.tick(fixedStepMs / 1000);
            }
            schedulerState.accumulatorMs -= fixedStepMs;
            stepsThisFrame += 1;
        }
        physicsMs = performance.now() - physicsStart;
    }

    const capHit = !freezeThisFrame && (stepsThisFrame >= maxSteps);
    const budgetExceeded = !freezeThisFrame && (physicsMs >= effectiveBudget);

    let droppedMs = clampedMs;
    let dropReason = 'NONE';

    const slushThreshold = fixedStepMs * 2;
    if (schedulerState.accumulatorMs > slushThreshold) {
        overloadState.debtFrames += 1;
    } else {
        overloadState.debtFrames = 0;
    }

    if (freezeThisFrame) {
        droppedMs += schedulerState.accumulatorMs;
        dropReason = 'FREEZE';
        schedulerState.accumulatorMs = 0;
    } else if (capHit || budgetExceeded) {
        if (schedulerState.accumulatorMs > 0) {
            droppedMs += schedulerState.accumulatorMs;
            dropReason = budgetExceeded ? 'BUDGET_DROP' : 'CAP_DROP';
            schedulerState.accumulatorMs = 0;
        }
    } else if (overloadState.debtFrames > 2) {
        droppedMs += schedulerState.accumulatorMs;
        dropReason = 'WATCHDOG_DROP';
        schedulerState.accumulatorMs = 0;
    }

    if (overloadSeverity === 'NONE') {
        if (droppedMs > fixedStepMs && dropReason !== 'NONE') {
            overloadReason = dropReason;
            overloadSeverity = 'HARD';
        } else if (budgetExceeded) {
            overloadReason = 'BUDGET_HIT';
            overloadSeverity = 'SOFT';
        }
    }

    const overloadActive = overloadReason !== 'NONE';
    if (overloadActive) {
        if (!overloadState.active || overloadReason !== overloadState.reason || overloadSeverity !== overloadState.severity) {
            overloadState.overloadCount += 1;
        }
        overloadState.lastOverloadAt = now;
    }
    overloadState.active = overloadActive;
    overloadState.reason = overloadReason;
    overloadState.severity = overloadSeverity;
    if (freezeThisFrame) {
        overloadState.freezeCount += 1;
        overloadState.debtFrames = 0;
        overloadState.lastFreezeAt = now;
    }

    const nextDegradeLevel = overloadSeverity === 'HARD' ? 2 : overloadSeverity === 'SOFT' ? 1 : 0;
    if (nextDegradeLevel > 0) {
        overloadState.degradeLevel = nextDegradeLevel;
        overloadState.degradeReason = overloadReason;
        overloadState.degradeHoldFrames = nextDegradeLevel === 2 ? 12 : 6;
    } else if (overloadState.degradeHoldFrames > 0) {
        overloadState.degradeHoldFrames -= 1;
    } else {
        overloadState.degradeLevel = 0;
        overloadState.degradeReason = 'NONE';
    }

    return {
        dtMs,
        accumulatorMs: schedulerState.accumulatorMs,
        droppedMs,
        stepsThisFrame,
        tickMsTotal,
        physicsMs,
        baseBudget,
        fixedStepMs,
        overloadReason,
        overloadSeverity,
    };
};
