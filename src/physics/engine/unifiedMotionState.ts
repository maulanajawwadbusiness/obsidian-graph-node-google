import type { ForceConfig } from '../types';

export type MotionAuthority = 'dragged' | 'normal' | 'sleeping';

export type UnifiedMotionState = {
    temperature: number;
    density: number;
    degree: number;
    authority: MotionAuthority;
    budgetScale: number;
};

export type UnifiedMotionStateInput = {
    energy: number;
    nodeCount: number;
    linkCount: number;
    sleepingCount: number;
    draggedNodeId: string | null;
    budgetScale: number;
    config: ForceConfig;
};

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const smoothstep = (edge0: number, edge1: number, x: number) => {
    const t = clamp01((x - edge0) / Math.max(0.0001, edge1 - edge0));
    return t * t * (3 - 2 * t);
};

export const computeUnifiedMotionState = (input: UnifiedMotionStateInput): UnifiedMotionState => {
    const { energy, nodeCount, linkCount, sleepingCount, draggedNodeId, budgetScale, config } = input;

    // Unified Motion Invariants:
    // - Same equations at all Dot counts (no special-case laws).
    // - Degrade may change sampling cadence only (never stiffness/force laws).
    // - Drag remains knife-sharp regardless of load (hand authority wins).
    const temperature = clamp01(energy);
    const avgDegree = nodeCount > 0 ? (linkCount * 2) / nodeCount : 0;
    const degree = clamp01((avgDegree - 1) / 4);

    const densityByNodes = clamp01(
        (nodeCount - config.perfModeNStressed) /
        Math.max(1, config.perfModeNFatal - config.perfModeNStressed)
    );
    const densityByLinks = clamp01(
        (linkCount - config.perfModeEStressed) /
        Math.max(1, config.perfModeEFatal - config.perfModeEStressed)
    );
    const density = Math.max(densityByNodes, densityByLinks);

    const authority: MotionAuthority = draggedNodeId
        ? 'dragged'
        : nodeCount > 0 && sleepingCount >= nodeCount
            ? 'sleeping'
            : 'normal';

    return {
        temperature,
        density,
        degree,
        authority,
        budgetScale: clamp01(budgetScale),
    };
};
