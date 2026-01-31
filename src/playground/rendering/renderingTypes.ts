import type { SkinMode } from '../../visual/theme';
import type { MutableRefObject } from 'react';

export type { MutableRefObject };

export type RenderSettings = {
    useVariedSize: boolean;
    skinMode: SkinMode;
    cameraLocked: boolean;
    showDebugGrid: boolean;
    pixelSnapping: boolean;
    debugNoRenderMotion: boolean;
    showRestMarkers: boolean;
    showConflictMarkers: boolean;
    markerIntensity: number;
    forceShowRestMarkers: boolean;
};

export type PendingPointerState = {
    clientX: number;
    clientY: number;
    pointerId: number;
    pointerType: string;
    hasPending: boolean;
    pendingDragStart: { nodeId: string; clientX: number; clientY: number; } | null;
};

export type HoverState = {
    hoveredNodeId: string | null;
    hoverDisplayNodeId: string | null;
    hoveredDistPx: number;
    cursorWorldX: number;
    cursorWorldY: number;
    cursorScreenX: number;
    cursorScreenY: number;
    cursorClientX: number;
    cursorClientY: number;
    hasPointer: boolean;
    lastLoggedId: string | null;
    lastDecision: string;
    nearestCandidateId: string | null;
    nearestCandidateDist: number;
    lastDtMs: number;
    lastDtClampedMs: number;
    lastAlpha: number;
    wasDtClamped: boolean;
    debugStateLogged: boolean;
    nodesScannedLastSelection: number;
    selectionRunCount: number;
    energyUpdateCount: number;
    selectionRunsPerSecond: number;
    energyUpdatesPerSecond: number;
    lastPerfSampleTime: number;
    lastSelectionPanX: number;
    lastSelectionPanY: number;
    lastSelectionZoom: number;
    lastSelectionAngle: number;
    lastSelectionCentroidX: number;
    lastSelectionCentroidY: number;
    hitRadius: number;
    spikeLogged: boolean;
    activePointerId: number | null;
    energy: number;
    targetEnergy: number;
    renderedRadius: number;
    haloRadius: number;
    hoverHoldUntilMs: number;
    lastInsideMs: number;
    pendingSwitchId: string | null;
    pendingSwitchSinceMs: number;
    // Debug: glow energy values
    debugGlowInnerAlpha: number;
    debugGlowInnerBlur: number;
    debugGlowOuterAlpha: number;
    debugGlowOuterBlur: number;
    debugNodeEnergy: number;
    // State Generation Tracking (Phase 5)
    surfaceGeneration: number;
    cameraKey: string;
    lastClientX: number;
    lastClientY: number;

    // Snap Hysteresis (Phase 6)
    isMoving: boolean;
    lastMoveTime: number;
    lastSelectionTime: number;
    snapEnabled: boolean;

    // Debug / Perf
    debugNodeRadius: number;
    debugOuterRadius: number;
    debugOcclusionRadius: number;
    debugShrinkPct: number;

    // Overload Detection
    slushFrameCount?: number;
    lastSlushLog?: number;
    lastDropLog?: number;
};

export type CanvasStateDebug = {
    globalCompositeOperation: string;
    globalAlpha: number;
    filter: string;
};

export type RenderDebugInfo = {
    drawOrder: string[];
    idleGlowPassIndex: number;
    activeGlowPassIndex: number;
    ringPassIndex: number;
    idleGlowStateBefore: CanvasStateDebug;
    idleGlowStateAfter: CanvasStateDebug;
    idleRingStateBefore: CanvasStateDebug;
    idleRingStateAfter: CanvasStateDebug;
    activeGlowStateBefore: CanvasStateDebug;
    activeGlowStateAfter: CanvasStateDebug;
    activeRingStateBefore: CanvasStateDebug;
    activeRingStateAfter: CanvasStateDebug;
    restMarkerStats?: RestMarkerStats;
    energyLedger?: { stage: string; energy: number; delta: number }[];
    fightLedger?: { stage: string; conflictPct: number; avgCorr: number }[];
};

export type RestMarkerStats = {
    enabled: boolean;
    drawPassCalled: boolean;
    lastDrawTime: number;
    candidateCount: number;
    sleepingCount: number;
    jitterWarnCount: number;
    epsUsed: number;
    sampleSpeed: number;
    // Forensic Predicate Counts
    countA: number; // hudSettleState === 'sleep'
    countB: number; // isSleeping === true
    countC: number; // sleepFrames > 0
    countD: number; // speedSq < jitterWarnSq
    // Speed Sanity
    minSpeedSq: number;
    meanSpeedSq: number;
    maxSpeedSq: number;
    nanSpeedCount: number;
    sampleNodeId?: string;
    sampleNodeVx?: number;
    sampleNodeVy?: number;
    sampleNodeSpeedSq?: number;
    sampleNodeSleepFrames?: number;
    sampleNodeIsSleeping?: boolean;
};

// FIX 46: Surface Safety Snapshot (Last Good State)
export type SurfaceSnapshot = {
    displayWidth: number;
    displayHeight: number;
    rectWidth: number;
    rectHeight: number;
    dpr: number;
};

export type CameraState = {
    panX: number;
    panY: number;
    zoom: number;
    targetPanX: number;
    targetPanY: number;
    targetZoom: number;
    lastRecenterCentroidX: number;
    lastRecenterCentroidY: number;
    lastInteractionTime: number; // FIX 43: Causality (Track last interaction)
};

export const createInitialRenderSettings = (): RenderSettings => ({
    useVariedSize: true,
    skinMode: 'normal',
    cameraLocked: false,
    showDebugGrid: false,
    pixelSnapping: false,
    debugNoRenderMotion: false,
    showRestMarkers: false,
    showConflictMarkers: false,
    markerIntensity: 1,
    forceShowRestMarkers: false
});

export const createInitialPendingPointer = (): PendingPointerState => ({
    clientX: 0,
    clientY: 0,
    pointerId: -1,
    pointerType: 'mouse',
    hasPending: false,
    pendingDragStart: null
});

export const createInitialHoverState = (): HoverState => ({
    hoveredNodeId: null,
    hoverDisplayNodeId: null,
    hoveredDistPx: 0,
    cursorWorldX: 0,
    cursorWorldY: 0,
    cursorScreenX: 0,
    cursorScreenY: 0,
    cursorClientX: 0,
    cursorClientY: 0,
    hasPointer: false,
    lastLoggedId: null,
    lastDecision: '',
    nearestCandidateId: null,
    nearestCandidateDist: Infinity,
    lastDtMs: 0,
    lastDtClampedMs: 0,
    lastAlpha: 0,
    wasDtClamped: false,
    debugStateLogged: false,
    nodesScannedLastSelection: 0,
    selectionRunCount: 0,
    energyUpdateCount: 0,
    selectionRunsPerSecond: 0,
    energyUpdatesPerSecond: 0,
    lastPerfSampleTime: 0,
    lastSelectionPanX: 0,
    lastSelectionPanY: 0,
    lastSelectionZoom: 1,
    lastSelectionAngle: 0,
    lastSelectionCentroidX: 0,
    lastSelectionCentroidY: 0,
    hitRadius: 0,
    spikeLogged: false,
    activePointerId: null,
    energy: 0,
    targetEnergy: 0,
    renderedRadius: 0,
    haloRadius: 0,
    hoverHoldUntilMs: 0,
    lastInsideMs: 0,
    pendingSwitchId: null,
    pendingSwitchSinceMs: 0,
    // State Generation Tracking (Phase 5)
    surfaceGeneration: 0,
    cameraKey: '',
    lastClientX: 0,
    lastClientY: 0,

    // Snap Hysteresis
    isMoving: false,
    lastMoveTime: 0,
    lastSelectionTime: 0,
    snapEnabled: true,
    // Debug: glow energy values
    debugGlowInnerAlpha: 0,
    debugGlowInnerBlur: 0,
    debugGlowOuterAlpha: 0,
    debugGlowOuterBlur: 0,
    debugNodeEnergy: 0,
    // Debug: occlusion disk sizing
    debugNodeRadius: 0,
    debugOuterRadius: 0,
    debugOcclusionRadius: 0,
    debugShrinkPct: 0
});

export const createInitialRenderDebug = (): RenderDebugInfo => ({
    drawOrder: [],
    idleGlowPassIndex: -1,
    activeGlowPassIndex: -1,
    ringPassIndex: -1,
    idleGlowStateBefore: { globalCompositeOperation: 'source-over', globalAlpha: 1, filter: 'none' },
    idleGlowStateAfter: { globalCompositeOperation: 'source-over', globalAlpha: 1, filter: 'none' },
    idleRingStateBefore: { globalCompositeOperation: 'source-over', globalAlpha: 1, filter: 'none' },
    idleRingStateAfter: { globalCompositeOperation: 'source-over', globalAlpha: 1, filter: 'none' },
    activeGlowStateBefore: { globalCompositeOperation: 'source-over', globalAlpha: 1, filter: 'none' },
    activeGlowStateAfter: { globalCompositeOperation: 'source-over', globalAlpha: 1, filter: 'none' },
    activeRingStateBefore: { globalCompositeOperation: 'source-over', globalAlpha: 1, filter: 'none' },
    activeRingStateAfter: { globalCompositeOperation: 'source-over', globalAlpha: 1, filter: 'none' },
    energyLedger: [],
    fightLedger: []
});

export interface RenderTickDetail {
    transform: { worldToScreen: (x: number, y: number) => { x: number, y: number } };
    dpr: number;
    snapEnabled: boolean;
}
