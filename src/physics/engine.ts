import { PhysicsNode, PhysicsLink, ForceConfig } from './types';
import { DEFAULT_PHYSICS_CONFIG } from './config';
import { fireInitialImpulse } from './engine/impulse';
import { type DebugStats } from './engine/stats';
import { createInitialPhysicsHudHistory, createInitialPhysicsHudSnapshot, type PhysicsHudHistory, type PhysicsHudSnapshot } from './engine/physicsHud';
import { getNowMs } from './engine/engineTime';
import { runPhysicsTick, type PhysicsEngineTickContext } from './engine/engineTick';

export class PhysicsEngine {
    public nodes: Map<string, PhysicsNode> = new Map();
    public links: PhysicsLink[] = [];
    public config: ForceConfig;

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

    private lastDebugStats: DebugStats | null = null;
    public hudSnapshot: PhysicsHudSnapshot = createInitialPhysicsHudSnapshot();
    public hudHistory: PhysicsHudHistory = createInitialPhysicsHudHistory();
    public hudSettleState: PhysicsHudSnapshot['settleState'] = 'moving';
    public hudSettleStateAt: number = getNowMs();

    // Fix: Micro-Jitter Forensic Kill-Switches (Dev Only)
    public debugDisableDiffusion: boolean = false;
    public debugDisableMicroSlip: boolean = false;
    public debugDisableRepulsion: boolean = false;
    private spacingGate: number = 0;
    private spacingGateActive: boolean = false;
    private nodeListCache: PhysicsNode[] = [];
    private nodeListDirty: boolean = true;
    private awakeList: PhysicsNode[] = [];
    private sleepingList: PhysicsNode[] = [];
    private correctionAccumCache = new Map<string, { dx: number; dy: number }>();
    private topologyLinkKeys = new Set<string>();
    private nodeLinkCounts = new Map<string, number>();

    // Fix 22: Prioritize unresolved constraints (Hot Pairs) to prevent crawl
    public spacingHotPairs = new Set<string>();

    private perfCounters = {
        nodeListBuilds: 0,
        correctionNewEntries: 0,
        topologySkipped: 0,
        topologyDuplicates: 0,
    };
    private perfMode: 'normal' | 'stressed' | 'emergency' | 'fatal' = 'normal';
    private perfModeLogAt: number = 0;
    private spacingLogAt: number = 0;
    private passLogAt: number = 0;
    private degradeLevel: number = 0;
    private degradeReason: string = 'NONE';
    private degradeSeverity: 'NONE' | 'SOFT' | 'HARD' = 'NONE';
    private degradeBudgetMs: number = 0;
    private degradeLogAt: number = 0;
    private handLogAt: number = 0;
    private dragLagSamples: number[] = [];
    private localBoostFrames: number = 0;
    private perfTiming = {
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
    private lastDraggedNodeId: string | null = null;

    // Fix #11: Impulse Guard State
    private lastImpulseTime: number = 0;

    // Fix #14: Wake Throttling State
    private lastWakeTime: number = 0;

    // Adjacency Cache for O(1) wake lookups (Fix 12)
    private adjacencyMap = new Map<string, string[]>();

    constructor(config: Partial<ForceConfig> = {}) {
        this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };
        this.preRollFrames = this.config.initStrategy === 'legacy' ? 5 : 0;
    }

    /**
     * Lock physics rules (degrade mode) to current state.
     */
    lockInteraction(reason: string) {
        if (!this.interactionLock) {
            this.interactionLock = true;
            this.interactionLockReason = reason;
            if (this.config.debugPerf) {
                console.log(`[PhysicsLock] Locked (${reason})`);
            }
        }
    }

    /**
     * Unlock physics rules.
     */
    unlockInteraction() {
        if (this.interactionLock) {
            this.interactionLock = false;
            this.interactionLockReason = null;
            if (this.config.debugPerf) {
                console.log(`[PhysicsLock] Unlocked`);
            }
        }
    }

    /**
     * Get stable array of nodes (cached).
     * Faster than .values() iterator for heavy loops.
     */
    public getNodeList(): PhysicsNode[] {
        if (this.nodeListDirty) {
            this.nodeListCache = Array.from(this.nodes.values());
            this.nodeListDirty = false;
            // Also reset awake/sleep lists if needed? 
            // Usually managed by engineTick.
        }
        return this.nodeListCache;
    }

    /**
     * Add a node to the simulation.
     */
    addNode(node: PhysicsNode) {
        this.nodes.set(node.id, node);
        this.nodeListDirty = true;
        if (!this.nodeLinkCounts.has(node.id)) {
            this.nodeLinkCounts.set(node.id, 0);
        }
        if (!this.adjacencyMap.has(node.id)) {
            this.adjacencyMap.set(node.id, []);
        }
        this.wakeNode(node.id);
        this.invalidateWarmStart('TOPOLOGY_CHANGE');
    }

    /**
     * Add a link between two nodes.
     */
    addLink(link: PhysicsLink) {
        const source = link.source;
        const target = link.target;
        // FIX 15: Strict Dedupe (Min:Max)
        const key = source < target ? `${source}:${target}` : `${target}:${source}`;

        if (this.topologyLinkKeys.has(key)) {
            this.perfCounters.topologyDuplicates += 1;
            if (this.config.debugPerf) console.warn(`[Topology] Duplicate rejected: ${key}`);
            return;
        }

        const sourceCount = this.nodeLinkCounts.get(source) || 0;
        const targetCount = this.nodeLinkCounts.get(target) || 0;

        // FIX 15: Degree Cap
        if (sourceCount >= this.config.maxLinksPerNode || targetCount >= this.config.maxLinksPerNode) {
            this.perfCounters.topologySkipped += 1;
            // this.warnTopology('maxLinksPerNode', link); 
            // Inline warning logic to be safe/explicit
            if (this.config.debugPerf) {
                console.warn(`[Topology] Degree Limit s=${sourceCount} t=${targetCount} cap=${this.config.maxLinksPerNode}`);
            }
            return;
        }
        if (this.links.length >= this.config.maxTotalLinks) {
            this.perfCounters.topologySkipped += 1;
            if (this.config.debugPerf) console.warn('[Topology] Max total links reached');
            return;
        }

        this.links.push(link);
        this.topologyLinkKeys.add(key);
        this.nodeLinkCounts.set(source, sourceCount + 1);
        this.nodeLinkCounts.set(target, targetCount + 1);

        // Update Adjacency (Fix 12)
        if (!this.adjacencyMap.has(source)) this.adjacencyMap.set(source, []);
        if (!this.adjacencyMap.has(target)) this.adjacencyMap.set(target, []);
        this.adjacencyMap.get(source)?.push(target);
        this.adjacencyMap.get(target)?.push(source);

        this.wakeNode(link.source);
        this.wakeNode(link.target);
        this.invalidateWarmStart('TOPOLOGY_CHANGE');
    }

    /**
     * Clear warm-start caches to prevent phantom pushes (Fix 10).
     */
    public invalidateWarmStart(reason: string) {
        // Clear Hysteresis
        this.clampedPairs.clear();

        // Clear directional inertia on all nodes
        for (const node of this.nodes.values()) {
            delete node.lastCorrectionDir;
            node.correctionResidual = undefined; // Fix 16/17: Clear debt on mode switch
            node.prevFx = 0;
            node.prevFy = 0;
            // Reset equilibrium if topology changes significantly? 
            // Maybe too aggressive, but safer for "no phantom motion".
            // We'll keep equilibrium for now as it's computed via special algo.
        }

        if (this.config.debugPerf) {
            console.log(`[WarmStart] Invalidation Triggered: ${reason}`);
        }
    }

    /**
     * Clear all entities.
     */
    clear() {
        this.nodes.clear();
        this.links = [];
        this.nodeListCache.length = 0;
        this.awakeList.length = 0;
        this.sleepingList.length = 0;
        this.nodeListDirty = true;
        this.correctionAccumCache.clear();
        this.topologyLinkKeys.clear();
        this.nodeLinkCounts.clear();
        this.adjacencyMap.clear(); // Fix 12
        this.spacingHotPairs.clear(); // Fix 22
        this.lifecycle = 0;
        this.hasFiredImpulse = false;
        this.spacingGate = 0;
        this.spacingGateActive = false;
        this.globalAngle = 0;
        this.globalAngularVel = 0;
        this.hudSnapshot = createInitialPhysicsHudSnapshot();
        this.hudHistory = createInitialPhysicsHudHistory();
        this.hudSettleState = 'moving';
        this.hudSettleStateAt = getNowMs();
    }

    /**
     * Update configuration at runtime.
     */
    updateConfig(newConfig: Partial<ForceConfig>) {
        this.config = { ...this.config, ...newConfig };
        this.wakeAll();
        // Config changes might alter solver physics => clear caches
        this.invalidateWarmStart('CONFIG_CHANGE');
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
        if (this.interactionLock) {
            // Allow FATAL updates or resets, but block normal fluctuations
            if (severity !== 'HARD' && level !== 0) {
                // But wait, if we are locked, we want to STAY in current mode.
                // So we just return and ignore the scheduler's suggestion.
                return;
            }
            // Actually, we should probably ignore EVERYTHING except maybe emergency checks?
            // User requested: "freeze mode (normal/degrade/stressed)".
            // So we simply ignore this call if locked.
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
        this.lifecycle = 0;
        this.hasFiredImpulse = false;
        this.preRollFrames = this.config.initStrategy === 'legacy' ? 5 : 0;  // Reset pre-roll
        this.spacingGate = 0;
        this.spacingGateActive = false;
        this.wakeAll();
        this.invalidateWarmStart('RESET_LIFECYCLE');
        this.hudSnapshot = createInitialPhysicsHudSnapshot();
        this.hudHistory = createInitialPhysicsHudHistory();
        this.hudSettleState = 'moving';
        this.hudSettleStateAt = getNowMs();
    }

    /**
     * Wake up a specific node.
     */
    wakeNode(nodeId: string) {
        const node = this.nodes.get(nodeId);
        if (node) {
            node.warmth = 1.0;
            node.isSleeping = false;
            node.sleepFrames = 0;
            // FIX 13: Clear pressure memory on wake to prevent "pop"
            node.lastCorrectionMag = 0;

            // Clear PBD accumulator immediately (in case it was hot)
            const accum = this.correctionAccumCache.get(nodeId);
            if (accum) {
                accum.dx = 0;
                accum.dy = 0;
            }
        }
    }

    /**
     * Wake up a node and its neighbors (Optimized for Fix 12).
     */
    wakeNeighbors(nodeId: string) {
        // FIX 12: Use O(1) Adjacency Map instead of O(Links)
        const neighbors = this.adjacencyMap.get(nodeId);
        if (neighbors) {
            // FIX 12: Wake propagation limit
            // Only wake neighbors if they are not already "very hot" to avoid redundant ops?
            // Actually, we must ensure they are awake. But we can skip if warmth is already 1.0.
            for (const nbId of neighbors) {
                this.wakeNode(nbId);
            }
        }
    }

    /**
     * Wake up everything (e.g. on config change).
     */
    wakeAll() {
        for (const node of this.nodes.values()) {
            node.warmth = 1.0;
            node.isSleeping = false;
            node.sleepFrames = 0;
        }
    }

    /**
     * Update World Bounds (from Canvas resize).
     */
    updateBounds(width: number, height: number) {
        this.worldWidth = width;
        this.worldHeight = height;
        this.wakeAll();
    }

    /**
     * Start dragging a node.
     */
    grabNode(nodeId: string, position: { x: number, y: number }) {
        if (this.nodes.has(nodeId)) {
            this.draggedNodeId = nodeId;
            this.dragTarget = { ...position };
            this.lastDraggedNodeId = nodeId;

            // KINEMATIC LOCK: Override position directly (0 lag)
            const node = this.nodes.get(nodeId);
            if (node) {
                // FIX 14: Immutable Drag (Prevent Jitter)
                // Mark as fixed so constraints/integrator skip it entirely.
                // We become the sole writer to node.x/y via moveDrag.
                node.isFixed = true;

                node.vx = 0;
                node.vy = 0;
                node.fx = 0;
                node.fy = 0;

                // FIX 22: Clean Slate (Kill Momentum)
                // Clear all motion history so the dot doesn't "curve" due to past forces.
                node.prevFx = 0;
                node.prevFy = 0;
                node.correctionResidual = undefined;
                delete node.lastCorrectionDir;
            }

            this.wakeNode(nodeId);
            this.wakeNeighbors(nodeId);
        }
    }

    /**
     * Update drag position.
     */
    moveDrag(position: { x: number, y: number }) {
        if (this.draggedNodeId && this.dragTarget) {
            this.dragTarget = { ...position };

            // Always wake self (ensure velocity is integrated)
            this.wakeNode(this.draggedNodeId);

            // FIX #14: THROTTLED WAKE PROPAGATION
            // Only wake neighbors every 100ms to prevent "boil" (energy pumping)
            const now = getNowMs();
            if (now - this.lastWakeTime > 100) {
                this.wakeNeighbors(this.draggedNodeId);
                this.lastWakeTime = now;
            }
        }
    }

    /**
     * Release the node.
     */
    releaseNode() {
        if (this.draggedNodeId) {
            const node = this.nodes.get(this.draggedNodeId);
            if (node) {
                // FIX 13: Atomic Release (Kill Ghost Slide)
                // Zero out ALL motion history so it stops dead.
                node.vx = 0;
                node.vy = 0;
                node.fx = 0;
                node.fy = 0;
                node.prevFx = 0;
                node.prevFy = 0;

                // Clear constraint debt
                node.correctionResidual = undefined;
                delete node.lastCorrectionDir;
                node.lastCorrectionMag = 0;

                // Unlock
                node.isFixed = false;
            }
        }
        // Hard clear all drag state
        this.draggedNodeId = null;
        this.dragTarget = null;
        this.lastDraggedNodeId = null;
        this.idleFrames = 0; // FIX 44: Wake Up
    }

    /**
     * Request an impulse kick.
     * FIX #11: Strict cooldown (>1s) + Interaction Guard (no drag).
     */
    requestImpulse() {
        if (this.config.initStrategy !== 'legacy') {
            return;
        }
        const now = getNowMs();

        // Guard 1: Cooldown (1000ms)
        if (now - this.lastImpulseTime < 1000) {
            return;
        }

        // Guard 2: Interaction (Don't kick while user holds a node)
        if (this.draggedNodeId) {
            return;
        }

        // Fire!
        fireInitialImpulse(this, now);
        this.lastImpulseTime = now;
        this.hasFiredImpulse = true;
        this.idleFrames = 0; // FIX 44: Wake Up
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
