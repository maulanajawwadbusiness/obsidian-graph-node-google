import type { PhysicsLink, PhysicsNode, ForceConfig } from '../types';
import type { DebugStats } from './stats';
import type { PhysicsHudHistory, PhysicsHudSnapshot } from './physicsHud';
import type { TimePolicy } from './dtPolicy';

export type PhysicsEngineTickContext = {
    nodes: Map<string, PhysicsNode>;
    links: PhysicsLink[];
    config: ForceConfig;
    draggedNodeId: string | null;
    dragTarget: { x: number; y: number } | null;
    awakeList: PhysicsNode[];
    sleepingList: PhysicsNode[];
    lifecycle: number;
    frameIndex: number;
    preRollFrames: number;
    hasFiredImpulse: boolean;
    localBoostFrames: number;
    spacingGate: number;
    spacingGateActive: boolean;
    // FIX 44: Idle Rest Mode
    idleFrames: number;
    spacingHotPairs: Set<string>;
    perfMode: 'normal' | 'stressed' | 'emergency' | 'fatal';
    perfModeLogAt: number;
    spacingLogAt: number;
    passLogAt: number;
    degradeLevel: number;
    degradeReason: string;
    degradeSeverity: 'NONE' | 'SOFT' | 'HARD';
    degradeBudgetMs: number;
    degradeLogAt: number;
    handLogAt: number;
    dragLagSamples: number[];
    lastDraggedNodeId: string | null;
    grabOffset: { x: number; y: number } | null;  // Mini Run 7: Initial grab position for MAX_DRAG_DISTANCE
    lastReleasedNodeId: string | null;  // Mini Run 7: Track which node was just released
    lastReleaseFrame: number;  // Mini Run 7: Frame index when node was released
    correctionAccumCache: Map<string, { dx: number; dy: number }>;
    // Fix: Startup Stats
    startupStats: {
        nanCount: number;
        infCount: number;
        maxSpeed: number;
        dtClamps: number;
        overlapCount0: number;
        overlapCount100: number;
        peakOverlapFirst2s30: number; // New
        peakOverlapFirst2s100: number; // New
        spawnSetHash: number; // New
        orderHashChanged: boolean; // New
        spawnOrderHash: number;
        strictClampActive: boolean;
        strictClampTicksLeft: number;
        strictClampActionAppliedCount: number; // New
    };
    perfCounters: {
        nodeListBuilds: number;
        correctionNewEntries: number;
        topologySkipped: number;
        topologyDuplicates: number;
    };
    nodeLinkCounts: Map<string, number>;
    perfTiming: {
        lastReportAt: number;
        frameCount: number;
        totals: {
            repulsionMs: number;
            collisionMs: number;
            springsMs: number;
            spacingMs: number;
            pbdMs: number;
            totalMs: number;
        };
    };
    lastDebugStats: DebugStats | null;
    hudSnapshot: PhysicsHudSnapshot;
    hudHistory: PhysicsHudHistory;
    hudSettleState: PhysicsHudSnapshot['settleState'];
    hudSettleStateAt: number;
    worldWidth: number;
    worldHeight: number;
    getNodeList: () => PhysicsNode[];
    requestImpulse: () => void;
    // Fix: Kill-Switches
    debugDisableDiffusion?: boolean;
    debugDisableMicroSlip?: boolean;
    debugDisableRepulsion?: boolean;
    debugDisableConstraints?: boolean;
    firewallStats: {
        nanResets: number;
        velClamps: number;
        dtClamps: number;
    };
    timePolicy: TimePolicy;
    // Rest Logic
    settleConfidence: number; // 0.0 (Active) to 1.0 (Calm)
    stateFlipTracking: { count: number; lastFlipMs: number; windowStartMs: number; flipHistory: number[] };

    // FIX D: Scale & Determinism
    localDensityCache: Map<string, number>;
    onWorldShift?: (dx: number, dy: number) => void;

    // XPBD Frame Accumulation
    xpbdFrameAccum: {
        ticks: number;
        dtSum: number;
        springs: {
            count: number;
            iter: number;
            corrSum: number;
            errSum: number;
            solveMs: number;
            corrMax: number;
            skipped: number;
            singularity: number;
            prevAdjusted: number;
            ghostVelMax: number;
            ghostVelEvents: number;
            releaseGhostEvents: number;
            dragLagMax: number;
            firstJumpPx: number;
            firstJumpPhase: 'integrate' | 'solver' | 'none';
            firstJumpNodeId: string | null;
            firstMovePx: number;
            firstMovePhase: 'pre' | 'integrate' | 'solver' | 'none';
            firstMoveNodeId: string | null;
            firstCapHit: boolean;
            firstAlpha: number;
            firstWSum: number;
            firstPreIntegrateJumpPx: number;
            firstPreIntegrateNodeId: string | null;
        };
        repel: { checked: number; solved: number; overlap: number; corrSum: number; sing: number };
        edgeConstraintsExecuted: number;
    };
    xpbdCanaryApplied?: boolean;

    // XPBD Inventory
    xpbdConstraints: XPBDConstraint[];
    xpbdConstraintsDirty: boolean;
    xpbdConstraintStats?: {
        minRest: number;
        maxRest: number;
        avgRest: number;
        invalidEndpointCount: number;
        nonFiniteRestLenCount: number;
        zeroLenEdgeCount: number;
    };
    xpbdFirstPairPrev?: {
        aId: string;
        bId: string;
        ax: number;
        ay: number;
        bx: number;
        by: number;
    } | null;
};

export interface XPBDConstraint {
    nodeA: string;
    nodeB: string;
    dist: number;      // Current Distance (cached for debug?) No, Rest Length.
    restLen: number;   // Target Distance (Policy Driven)
    compliance: number;
    lambda: number;    // Multiplier Accumulator
}
