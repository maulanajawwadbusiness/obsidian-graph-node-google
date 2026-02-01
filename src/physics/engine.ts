import { PhysicsNode, PhysicsLink, ForceConfig } from './types';
import { DEFAULT_PHYSICS_CONFIG } from './config';
import { type DebugStats } from './engine/stats';
import { createInitialPhysicsHudHistory, createInitialPhysicsHudSnapshot, type PhysicsHudHistory, type PhysicsHudSnapshot } from './engine/physicsHud';
import { getNowMs } from './engine/engineTime';
import { runPhysicsTick } from './engine/engineTick';
import type { PhysicsEngineTickContext } from './engine/engineTickTypes';
import { TimePolicy } from './engine/dtPolicy';
import { addLinkToEngine, addNodeToEngine, clearEngineState, invalidateWarmStart as invalidateWarmStartCaches, updateEngineConfig } from './engine/engineTopology';
import { grabNode, lockInteraction, moveDrag, releaseNode, requestImpulse, unlockInteraction, updateBounds, wakeAll, wakeNeighbors, wakeNode } from './engine/engineInteraction';
import { resetLifecycle } from './engine/engineLifecycle';
import type { XpbdSpatialGrid } from './engine/xpbd';

export class PhysicsEngine {
    public nodes: Map<string, PhysicsNode> = new Map();
    public links: PhysicsLink[] = [];
    public config: ForceConfig;

    // DT Policy (Time Hardening)
    public timePolicy = new TimePolicy();

    // DT Simulation Helpers (Dev Only)
    public debugSimulateJitterUntil: number = 0;
    public debugSimulateSpikeFrames: number = 0;

    // World Bounds for Containment
    public worldWidth: number = 2000;
    public worldHeight: number = 2000;

    // Interaction State
    public draggedNodeId: string | null = null;
    public dragTarget: { x: number, y: number } | null = null;
    public grabOffset: { x: number, y: number } | null = null; // Fix 18: Grab Offset (Prevents Jump)

    // Fix: Determinism Lock (Laws don't change during interaction)
    public interactionLock: boolean = false;
    public interactionLockReason: string | null = null;

    // FIX 44: Idle Rest Mode (Solver Coma)
    // Tracks frames where simple energy < threshold. 
    // If > N, we hard skip physics.
    public idleFrames: number = 0;

    // Lifecycle State (Startup Animation)
    public lifecycle: number = 0;
    public hasFiredImpulse: boolean = false;

    // Rotating Reference Frame (The Medium - initialized at impulse, decays with energy)
    public globalAngle: number = 0;       // Accumulated rotation (radians)
    public globalAngularVel: number = 0;  // Angular velocity (rad/s, + = CCW)

    // Hysteresis state for hard clamp (tracks pairs currently in clamped state)
    public clampedPairs = new Set<string>();

    // Pre-roll phase: soft separation before expansion (frames remaining)
    public preRollFrames: number = 5;  // ~80ms at 60fps

    // Escape window: frames remaining for trapped nodes to skip constraints
    public escapeWindow = new Map<string, number>();

    // Directional persistence: carrier direction for curved hub escape
    public carrierDir = new Map<string, { x: number, y: number }>();
    public carrierTimer = new Map<string, number>();  // Frames remaining for persistence

    // Frame counter for staggered integration
    public frameIndex: number = 0;

    public lastDebugStats: DebugStats | null = null;
    public hudSnapshot: PhysicsHudSnapshot = createInitialPhysicsHudSnapshot();
    public hudHistory: PhysicsHudHistory = createInitialPhysicsHudHistory();
    public hudSettleState: PhysicsHudSnapshot['settleState'] = 'moving';
    public hudSettleStateAt: number = getNowMs();

    // Fix: Micro-Jitter Forensic Kill-Switches (Dev Only)
    public debugDisableDiffusion: boolean = false;
    public debugDisableMicroSlip: boolean = false;
    public debugDisableRepulsion: boolean = false;
    public spacingGate: number = 0;
    public spacingGateActive: boolean = false;
    public nodeListCache: PhysicsNode[] = [];
    public nodeListDirty: boolean = true;
    public awakeList: PhysicsNode[] = [];
    public sleepingList: PhysicsNode[] = [];
    public correctionAccumCache = new Map<string, { dx: number; dy: number }>();
    public topologyLinkKeys = new Set<string>();
    public nodeLinkCounts = new Map<string, number>();

    // Fix 22: Prioritize unresolved constraints (Hot Pairs) to prevent crawl
    public spacingHotPairs = new Set<string>();

    // Forensic Phase 2: Neighbor Hysteresis Cache
    public neighborCache = new Map<string, Set<string>>();
    public xpbdSpatialGrid: XpbdSpatialGrid | null = null;
    public xpbdCanaryApplied: boolean = false;

    public perfCounters = {
        nodeListBuilds: 0,
        correctionNewEntries: 0,
        topologySkipped: 0,
        topologyDuplicates: 0,
    };
    public startupStats = {
        nanCount: 0,
        infCount: 0,
        maxSpeed: 0,
        dtClamps: 0
    };
    public firewallStats = {
        nanResets: 0,
        velClamps: 0,
        dtClamps: 0,
    };
    public perfMode: 'normal' | 'stressed' | 'emergency' | 'fatal' = 'normal';
    public perfModeLogAt: number = 0;
    public spacingLogAt: number = 0;
    public passLogAt: number = 0;
    public degradeLevel: number = 0;
    public degradeReason: string = 'NONE';
    public degradeSeverity: 'NONE' | 'SOFT' | 'HARD' = 'NONE';
    public degradeBudgetMs: number = 0;
    public degradeLogAt: number = 0;
    public handLogAt: number = 0;
    public dragLagSamples: number[] = [];
    public localBoostFrames: number = 0;
    public perfTiming = {
        lastReportAt: 0,
        frameCount: 0,
        totals: {
            repulsionMs: 0,
            collisionMs: 0,
            springsMs: 0,
            spacingMs: 0,
            pbdMs: 0,
            totalMs: 0,
        },
    };
    public lastDraggedNodeId: string | null = null;

    // Fix #11: Impulse Guard State
    public lastImpulseTime: number = 0;

    // Fix #14: Wake Throttling State
    public lastWakeTime: number = 0;

    // Adjacency Cache for O(1) wake lookups (Fix 12)
    public adjacencyMap = new Map<string, string[]>();

    // FIX A: World Shift Callback (Camera Sync)
    public onWorldShift?: (dx: number, dy: number) => void;

    // FIX D: Scale Caches (O(1) access)
    // Triangle cache: updated on topology change
    public triangleCache: [string, string, string][] | null = null;
    // Density cache: computed once per tick
    public localDensityCache = new Map<string, number>();

    constructor(config: Partial<ForceConfig> = {}) {
        this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };
        this.preRollFrames = this.config.initStrategy === 'legacy' ? 5 : 0;
    }

    /**
     * Deterministic Pseudo-Random Generator (Seeded by IDs)
     * Replaces Math.random() for overlap resolution to ensure cross-browser determinism.
     * Returns [0, 1)
     */
    public pseudoRandom(seedA: string, seedB: string = ''): number {
        let h = 0x811c9dc5;
        // Simple FNV-1a hash of the strings
        const str = seedA + seedB;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        h >>>= 0;
        // Mix with frame index to avoid static patterns, BUT must be careful.
        // If we want "deterministic given state", frame index is risky if frames drop.
        // Better: user wants "same scene yields same motion".
        // Overlap resolution should likely be static for a given pair (to avoid vibration).
        // Or if we need noise, use a counter that increments deterministically?
        // Let's stick to PURE hash of IDs first (stable direction).
        return (h % 1000000) / 1000000;
    }

    private resetStartupStats() {
        this.startupStats.nanCount = 0;
        this.startupStats.infCount = 0;
        this.startupStats.maxSpeed = 0;
        this.startupStats.dtClamps = 0;
    }

    /**
     * Lock physics rules (degrade mode) to current state.
     */
    lockInteraction(reason: string) {
        lockInteraction(this, reason);
    }

    /**
     * Unlock physics rules.
     */
    unlockInteraction() {
        unlockInteraction(this);
    }



    /**
     * Add a node to the simulation.
     */
    addNode(node: PhysicsNode) {
        addNodeToEngine(this, node);
    }

    /**
     * Add a link between two nodes.
     */
    addLink(link: PhysicsLink) {
        addLinkToEngine(this, link);
    }

    /**
     * Clear warm-start caches to prevent phantom pushes (Fix 10).
     */
    public invalidateWarmStart(reason: string) {
        invalidateWarmStartCaches(this, reason);
    }

    /**
     * Clear all entities.
     */
    clear() {
        clearEngineState(this);
    }

    /**
     * Update configuration at runtime.
     */
    updateConfig(newConfig: Partial<ForceConfig>) {
        updateEngineConfig(this, newConfig);
    }

    /**
     * Update overload-driven degrade state from the scheduler.
     */
    setDegradeState(
        level: number,
        reason: string,
        severity: 'NONE' | 'SOFT' | 'HARD',
        budgetMs: number
    ) {
        // FIX: Interaction Lock (Prevent mode switching during drag)
        // Allow FATAL updates or resets, but block normal fluctuations
        if (severity !== 'HARD' && level !== 0) {
            // If locked, we ignore non-critical updates
            return;
        }

        if (this.degradeLevel !== level) {
            this.invalidateWarmStart('MODE_CHANGE');
        }
        this.degradeLevel = Math.max(0, Math.min(2, Math.floor(level)));
        this.degradeReason = reason;
        this.degradeSeverity = severity;
        this.degradeBudgetMs = budgetMs;
    }

    public getDegradeState() {
        return {
            level: this.degradeLevel,
            reason: this.degradeReason,
            severity: this.degradeSeverity,
            budgetMs: this.degradeBudgetMs
        };
    }

    // =========================================================================
    // ROTATING FRAME: Public Access
    // =========================================================================

    /**
     * Get the accumulated global rotation angle (radians).
     * Apply this at render time to rotate all nodes around centroid.
     */
    getGlobalAngle(): number {
        return this.globalAngle;
    }

    /**
     * Get the current centroid of all nodes.
     */
    getCentroid(): { x: number, y: number } {
        const nodeList = this.getNodeList();
        if (nodeList.length === 0) return { x: 0, y: 0 };

        let cx = 0, cy = 0;
        for (const node of nodeList) {
            cx += node.x;
            cy += node.y;
        }
        return { x: cx / nodeList.length, y: cy / nodeList.length };
    }

    /**
     * Restart the lifecycle (Explosion effect).
     */
    resetLifecycle() {
        resetLifecycle(this);
    }

    /**
     * Wake up a specific node.
     */
    wakeNode(nodeId: string) {
        wakeNode(this, nodeId);
    }

    /**
     * Wake up a node and its neighbors (Optimized for Fix 12).
     */
    wakeNeighbors(nodeId: string) {
        wakeNeighbors(this, nodeId);
    }

    /**
     * Wake up everything (e.g. on config change).
     */
    wakeAll() {
        wakeAll(this);
    }

    /**
     * Update World Bounds (from Canvas resize).
     */
    updateBounds(width: number, height: number) {
        updateBounds(this, width, height);
    }

    /**
     * Start dragging a node.
     */
    grabNode(nodeId: string, position: { x: number, y: number }) {
        grabNode(this, nodeId, position);
    }

    /**
     * Update drag position.
     */
    moveDrag(position: { x: number, y: number }) {
        moveDrag(this, position);
    }

    /**
     * Release the node.
     */
    releaseNode() {
        releaseNode(this);
    }

    /**
     * Request an impulse kick.
     * FIX #11: Strict cooldown (>1s) + Interaction Guard (no drag).
     */
    requestImpulse() {
        requestImpulse(this);
    }

    /**
     * Get the most recent debug stats snapshot (if enabled in the engine loop).
     */
    getDebugStats(): DebugStats | null {
        return this.lastDebugStats;
    }

    /**
     * Get the most recent HUD snapshot (live physics metrics).
     */
    getHudSnapshot(): PhysicsHudSnapshot {
        return this.hudSnapshot;
    }

    /**
     * Main Physics Tick.
     * @param dt Delta time in seconds (e.g. 0.016 for 60fps)
     */
    tick(dt: number) {
        runPhysicsTick(this as PhysicsEngineTickContext, dt);
    }

    public getNodeList(): PhysicsNode[] {
        if (this.nodeListDirty) {
            this.nodeListCache.length = 0;
            for (const node of this.nodes.values()) {
                this.nodeListCache.push(node);
            }
            // FIX: Deterministic Ordering (Sort by ID)
            this.nodeListCache.sort((a, b) => a.id.localeCompare(b.id));

            this.nodeListDirty = false;
            this.perfCounters.nodeListBuilds += 1;
        }
        return this.nodeListCache;
    }

}
