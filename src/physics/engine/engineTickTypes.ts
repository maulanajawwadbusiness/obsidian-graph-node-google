import type { PhysicsLink, PhysicsNode, ForceConfig } from '../types';
import type { DebugStats } from './stats';
import type { PhysicsHudHistory, PhysicsHudSnapshot } from './physicsHud';
import type { TimePolicy } from './dtPolicy';
import type { XpbdSpatialGrid } from './xpbd';

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
    correctionAccumCache: Map<string, { dx: number; dy: number }>;
    // Fix: Startup Stats
    startupStats: {
        nanCount: number;
        infCount: number;
        maxSpeed: number;
        dtClamps: number;
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
    xpbdSpatialGrid: XpbdSpatialGrid | null;
    xpbdCanaryApplied: boolean;
};
