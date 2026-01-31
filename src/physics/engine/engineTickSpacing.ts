import type { PhysicsEngineTickContext } from './engineTickTypes';

export const computePairStride = (nodeCount: number, targetChecks: number, maxStride: number) => {
    if (nodeCount < 2) return 1;
    const pairCount = (nodeCount * (nodeCount - 1)) / 2;
    const safeTarget = Math.max(1, targetChecks);
    const stride = Math.ceil(pairCount / safeTarget);
    return Math.max(1, Math.min(maxStride, stride));
};

export type SpacingState = {
    pairStrideBase: number;
    spacingGate: number;
    spacingStride: number;
    spacingEnabled: boolean;
};

export const computeSpacingState = (
    engine: PhysicsEngineTickContext,
    nodeCount: number,
    energy: number,
    dt: number,
    pairBudgetScale: number
): SpacingState => {
    const pairStrideBase = pairBudgetScale > 0
        ? computePairStride(
            nodeCount,
            engine.config.pairwiseMaxChecks * pairBudgetScale,
            engine.config.pairwiseMaxStride
        )
        : engine.config.pairwiseMaxStride;

    const spacingGateOn = engine.config.spacingGateOnEnergy;
    const spacingGateOff = engine.config.spacingGateOffEnergy;
    if (engine.spacingGateActive) {
        if (energy > spacingGateOff) engine.spacingGateActive = false;
    } else if (energy < spacingGateOn) {
        engine.spacingGateActive = true;
    }

    let spacingGateTarget = 0;
    if (engine.spacingGateActive) {
        const rampStart = engine.config.spacingGateRampStart;
        const rampEnd = engine.config.spacingGateRampEnd;
        const denom = Math.max(0.0001, rampStart - rampEnd);
        const gateT = Math.max(0, Math.min(1, (rampStart - energy) / denom));
        spacingGateTarget = gateT * gateT * (3 - 2 * gateT);
    }

    const spacingGateRise = 1 - Math.exp(-dt / engine.config.spacingGateRiseTime);
    engine.spacingGate += (spacingGateTarget - engine.spacingGate) * spacingGateRise;
    const spacingGate = engine.spacingGate;
    const spacingEnabled = spacingGate > engine.config.spacingGateEnableThreshold;
    let spacingStride = pairStrideBase;
    if (spacingEnabled) {
        const scaledTarget = engine.config.pairwiseMaxChecks * spacingGate;
        spacingStride = computePairStride(
            nodeCount,
            scaledTarget,
            engine.config.pairwiseMaxStride
        );
    }

    return {
        pairStrideBase,
        spacingGate,
        spacingStride,
        spacingEnabled,
    };
};
